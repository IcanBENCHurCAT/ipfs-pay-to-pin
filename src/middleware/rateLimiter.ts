import { Context, Next } from 'hono';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 60;     // 60 requests per minute per IP

// Clean up stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export async function rateLimiterMiddleware(c: Context, next: Next) {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown-ip';
  const now = Date.now();

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

  if (record.count > MAX_REQUESTS) {
    return c.json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Maximum 60 requests per minute allowed."
    }, 429);
  }

  await next();
}
