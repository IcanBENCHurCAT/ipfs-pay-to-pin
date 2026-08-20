import { Context, Next } from 'hono';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 60;     // 60 requests per minute per IP
const MAX_MAP_SIZE = 5000;   // Prevent memory growth from infinite unique IPs
let lastPruneTime = Date.now();

// Clean up stale entries every 5 minutes to prevent memory leaks
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export { rateLimitCleanupInterval };

export async function rateLimiterMiddleware(c: Context, next: Next) {
  // Try native IP first (more secure), then fall back to headers (behind proxy)
  const nativeIp = (c.req.raw as any)?.ip || (c.req as any).raw?.ip;
  const ip = nativeIp
    || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown-ip';

  const now = Date.now();

  // ⚡ Bolt: Throttle O(N) map pruning to at most once per second.
  // Iterating a large map synchronously on every request blocks the event loop and causes DOS vulnerabilities during traffic spikes.
  if (rateLimitMap.size > MAX_MAP_SIZE && now - lastPruneTime > 1000) {
    lastPruneTime = now;
    for (const [ipKey, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(ipKey);
      }
    }
  }

  let record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + WINDOW_MS };
    rateLimitMap.set(ip, record);
  } else {
    record.count++;
  }

  c.header('X-RateLimit-Limit', MAX_REQUESTS.toString());
  c.header('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - record.count).toString());
  c.header('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

  // >= instead of > so exactly 60 requests are allowed (not 61)
  if (record.count >= MAX_REQUESTS) {
    return c.json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Maximum 60 requests per minute allowed."
    }, 429);
  }

  await next();
}
