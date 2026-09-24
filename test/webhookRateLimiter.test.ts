import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { webhookRateLimiterMiddleware, rateLimitMap, WINDOW_MS, MAX_REQUESTS, MAX_MAP_SIZE } from '../src/middleware/webhookRateLimiter';

beforeEach(() => {
  rateLimitMap.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  rateLimitMap.clear();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Webhook Rate Limiter Middleware', () => {
  it('should allow requests within the rate limit', async () => {
    const app = new Hono();
    app.use('/api/v1/webhooks', webhookRateLimiterMiddleware);
    app.get('/api/v1/webhooks', (c) => c.json({ ok: true }));

    // Simulate 10 requests within the limit of 20
    for (let i = 0; i < 10; i++) {
      const res = await app.request('/api/v1/webhooks');
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('20');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe(String(MAX_REQUESTS - (i + 1)));
    }
  });

  it('should return 429 after exceeding rate limit', async () => {
    const app = new Hono();
    app.use('/api/v1/webhooks', webhookRateLimiterMiddleware);
    app.get('/api/v1/webhooks', (c) => c.json({ ok: true }));

    // Exhaust the rate limit
    for (let i = 0; i < MAX_REQUESTS; i++) {
      const res = await app.request('/api/v1/webhooks');
      expect(res.status).toBe(200);
    }

    // Next request should be rate limited
    const res = await app.request('/api/v1/webhooks');
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error).toBe('Too Many Requests');
    expect(body.message).toContain('Maximum 20 requests per minute allowed');
  });

  it('should include Retry-After header when rate limited', async () => {
    const app = new Hono();
    app.use('/api/v1/webhooks', webhookRateLimiterMiddleware);
    app.get('/api/v1/webhooks', (c) => c.json({ ok: true }));

    // Exhaust the rate limit
    for (let i = 0; i < MAX_REQUESTS; i++) {
      await app.request('/api/v1/webhooks');
    }

    const res = await app.request('/api/v1/webhooks');
    expect(res.headers.get('Retry-After')).toBeTruthy();
    // Retry-After should be a positive number (seconds until reset)
    const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
    expect(retryAfter).toBeGreaterThan(0);
  });

  it('should reset rate limit after window expires', async () => {
    const app = new Hono();
    app.use('/api/v1/webhooks', webhookRateLimiterMiddleware);
    app.get('/api/v1/webhooks', (c) => c.json({ ok: true }));

    // Exhaust the rate limit
    for (let i = 0; i < MAX_REQUESTS; i++) {
      await app.request('/api/v1/webhooks');
    }

    // Next request should be rate limited
    let res = await app.request('/api/v1/webhooks');
    expect(res.status).toBe(429);

    // Advance time past the window
    vi.advanceTimersByTime(WINDOW_MS + 1000);

    // Should be able to make requests again
    res = await app.request('/api/v1/webhooks');
    expect(res.status).toBe(200);
  });

  it('should track rate limits per IP', async () => {
    // First app with test-ip-1
    const app1 = new Hono();
    app1.use('/api/v1/webhooks', webhookRateLimiterMiddleware);
    app1.get('/api/v1/webhooks', (c) => c.json({ ok: true }));

    // Exhaust rate limit for 'test-ip-1'
    for (let i = 0; i < MAX_REQUESTS; i++) {
      const res = await app1.request('/api/v1/webhooks', {
        headers: { 'X-Forwarded-For': 'test-ip-1' },
      });
      expect(res.status).toBe(200);
    }

    // Request from different IP should still work
    const res2 = await app1.request('/api/v1/webhooks', {
      headers: { 'X-Forwarded-For': 'test-ip-2' },
    });
    expect(res2.status).toBe(200);

    // Request from same IP should be rate limited
    const res3 = await app1.request('/api/v1/webhooks', {
      headers: { 'X-Forwarded-For': 'test-ip-1' },
    });
    expect(res3.status).toBe(429);
  });

  it('should expose correct constants for testing', () => {
    expect(MAX_REQUESTS).toBe(20);
    expect(WINDOW_MS).toBe(60 * 1000);
    expect(MAX_MAP_SIZE).toBe(1000);
  });

  it('should handle window expiry and reset', async () => {
    const webhookApp = new Hono();
    webhookApp.use('/api/v1/webhooks', webhookRateLimiterMiddleware);
    webhookApp.get('/api/v1/webhooks', (c) => c.json({ ok: true }));

    // Make some requests
    for (let i = 0; i < 5; i++) {
      const res = await webhookApp.request('/api/v1/webhooks', {
        headers: { 'X-Forwarded-For': 'expiry-test-ip' },
      });
      expect(res.status).toBe(200);
    }

    expect(rateLimitMap.size).toBe(1);

    // Advance past the window
    vi.advanceTimersByTime(WINDOW_MS + 1000);

    // Old entries should be expired; making a request creates a fresh record
    const res = await webhookApp.request('/api/v1/webhooks', {
      headers: { 'X-Forwarded-For': 'expiry-test-ip' },
    });
    expect(res.status).toBe(200);

    // Map should still have exactly 1 entry (the new one)
    expect(rateLimitMap.size).toBe(1);
  });

  it('should handle requests with no IP correctly', async () => {
    const appNoIp = new Hono();
    appNoIp.use('/api/v1/webhooks', webhookRateLimiterMiddleware);
    appNoIp.get('/api/v1/webhooks', (c) => c.json({ ok: true }));

    // Even with no IP (e.g., 'unknown-ip'), rate limiting should still work
    for (let i = 0; i < MAX_REQUESTS; i++) {
      const res = await appNoIp.request('/api/v1/webhooks', {
        headers: {}, // No X-Forwarded-For or other IP headers
      });
      expect(res.status).toBe(200);
    }

    // Should be rate limited
    const res = await appNoIp.request('/api/v1/webhooks', {
      headers: {},
    });
    expect(res.status).toBe(429);
  });
});
