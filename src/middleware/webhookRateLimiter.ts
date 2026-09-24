import { Context, Next } from 'hono';
import { config } from '../config.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 20;     // 20 requests per minute per IP (stricter for admin endpoint)
const MAX_MAP_SIZE = 1000;   // Prevent memory growth from infinite unique IPs
let lastPruneTime = Date.now();

// Clean up stale entries every 5 minutes to prevent memory leaks
export const webhookRateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Safely extracts the native IP address from Node/Hono request objects.
 */
function getNativeIp(c: Context): string | undefined {
  const rawObj = c.req.raw as unknown as Record<string, unknown> | undefined;
  if (typeof rawObj?.ip === 'string') {
    return rawObj.ip;
  }
  const reqObj = c.req as unknown as Record<string, unknown> | undefined;
  const nestedRaw = reqObj?.raw as Record<string, unknown> | undefined;
  if (typeof nestedRaw?.ip === 'string') {
    return nestedRaw.ip;
  }
  return undefined;
}

/**
 * Rate limiting middleware specific to the webhook admin endpoint.
 * Stricter limit (20 req/min) to prevent webhook management abuse.
 */
export async function webhookRateLimiterMiddleware(c: Context, next: Next) {
  const nativeIp = getNativeIp(c);
  const trustProxy = config.trustProxy || process.env.TRUST_PROXY === 'true';

  let ip = nativeIp;
  if (!ip && trustProxy) {
    ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip');
  }

  ip = ip || 'unknown-ip';

  const now = Date.now();

  // Throttle O(N) map pruning to at most once per second.
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
  c.header('Retry-After', String(Math.ceil((record.resetTime - now) / 1000)));

  if (record.count >= MAX_REQUESTS) {
    return c.json({
      error: "Too Many Requests",
      message: "Webhook admin endpoint rate limit exceeded. Maximum 20 requests per minute allowed."
    }, 429);
  }

  await next();
}

// Expose internal state for testing
export { rateLimitMap, WINDOW_MS, MAX_REQUESTS, MAX_MAP_SIZE };
