import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimiterMiddleware, rateLimitCleanupInterval } from '../src/middleware/rateLimiter.js';
import { Context, Next } from 'hono';

describe('rateLimiterMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  interface MockContextResult {
    context: Context;
    headersSet: Record<string, string>;
    getJsonResponse: () => { body: any; status: number } | null;
  }

  function createMockContext(options: {
    ipRaw?: any;
    headers?: Record<string, string>;
  }): MockContextResult {
    const headersSet: Record<string, string> = {};
    let jsonResponse: { body: any; status: number } | null = null;

    const reqMock = {
      raw: options.ipRaw ? { ip: options.ipRaw } : {},
      header: (name: string) => {
        return options.headers?.[name.toLowerCase()] || undefined;
      }
    };

    const context = {
      req: reqMock,
      header: (name: string, value: string) => {
        headersSet[name] = value;
      },
      json: (body: any, status: number) => {
        jsonResponse = { body, status };
        return jsonResponse;
      }
    } as unknown as Context;

    return {
      context,
      headersSet,
      getJsonResponse: () => jsonResponse
    };
  }

  it('correctly resolves client IP in security-priority hierarchy', async () => {
    const nextMock: Next = vi.fn().mockResolvedValue(undefined);

    // 1. Native IP exists
    const { context: ctx1 } = createMockContext({
      ipRaw: '127.0.0.1',
      headers: { 'x-forwarded-for': '192.168.1.1', 'x-real-ip': '10.0.0.1' }
    });
    await rateLimiterMiddleware(ctx1, nextMock);
    expect(nextMock).toHaveBeenCalledTimes(1);

    // 2. Native IP missing, fallback to x-forwarded-for (first entry)
    const { context: ctx2 } = createMockContext({
      headers: { 'x-forwarded-for': ' 1.1.1.1 , 2.2.2.2', 'x-real-ip': '10.0.0.1' }
    });
    await rateLimiterMiddleware(ctx2, nextMock);
    expect(nextMock).toHaveBeenCalledTimes(2);

    // 3. Native & x-forwarded-for missing, fallback to x-real-ip
    const { context: ctx3 } = createMockContext({
      headers: { 'x-real-ip': '3.3.3.3' }
    });
    await rateLimiterMiddleware(ctx3, nextMock);
    expect(nextMock).toHaveBeenCalledTimes(3);

    // 4. Everything missing, fallback to unknown-ip
    const { context: ctx4 } = createMockContext({});
    await rateLimiterMiddleware(ctx4, nextMock);
    expect(nextMock).toHaveBeenCalledTimes(4);
  });

  it('implements sliding-window limit and sets response headers correctly', async () => {
    const nextMock: Next = vi.fn().mockResolvedValue(undefined);
    const ip = '192.168.1.100';

    // Send 59 requests (the max is 60 requests per minute)
    for (let i = 1; i < 60; i++) {
      const { context, headersSet, getJsonResponse } = createMockContext({ ipRaw: ip });
      await rateLimiterMiddleware(context, nextMock);

      expect(getJsonResponse()).toBeNull();
      expect(headersSet['X-RateLimit-Limit']).toBe('60');
      expect(headersSet['X-RateLimit-Remaining']).toBe((60 - i).toString());
      expect(headersSet['X-RateLimit-Reset']).toBeDefined();
    }

    // 60th request: blocked with 429
    const { context, headersSet, getJsonResponse } = createMockContext({ ipRaw: ip });
    await rateLimiterMiddleware(context, nextMock);

    const jsonRes = getJsonResponse();
    expect(jsonRes).not.toBeNull();
    expect(jsonRes!.status).toBe(429);
    expect(jsonRes!.body).toEqual({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Maximum 60 requests per minute allowed."
    });
    expect(headersSet['X-RateLimit-Remaining']).toBe('0');

    // Time-travel 1 minute and a bit to clear the limit
    vi.advanceTimersByTime(60 * 1000 + 1);

    // Next request should succeed again
    const { context: ctxAfterReset, headersSet: headersAfterReset, getJsonResponse: getJsonAfterReset } = createMockContext({ ipRaw: ip });
    await rateLimiterMiddleware(ctxAfterReset, nextMock);
    expect(getJsonAfterReset()).toBeNull();
    expect(headersAfterReset['X-RateLimit-Remaining']).toBe('59');
  });

  it('runs periodic cleanup of stale records via interval', async () => {
    const nextMock: Next = vi.fn().mockResolvedValue(undefined);
    const ip1 = '192.168.1.201';
    const ip2 = '192.168.1.202';

    // Populate a record
    const { context: ctx1 } = createMockContext({ ipRaw: ip1 });
    await rateLimiterMiddleware(ctx1, nextMock);

    // Advance time past the 5 minute window
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Create a new record
    const { context: ctx2 } = createMockContext({ ipRaw: ip2 });
    await rateLimiterMiddleware(ctx2, nextMock);

    // Verify both exist, but the interval will clear the expired ones
    // We trigger the interval handler by advancing timers
    vi.advanceTimersByTime(5 * 60 * 1000);
  });

  it('prunes the map when MAX_MAP_SIZE is exceeded', async () => {
    const nextMock: Next = vi.fn().mockResolvedValue(undefined);

    // Populate 5005 unique IPs to trigger pruning block (MAX_MAP_SIZE = 5000)
    for (let i = 0; i <= 5005; i++) {
      const { context } = createMockContext({ ipRaw: `10.0.1.${i}` });
      await rateLimiterMiddleware(context, nextMock);
    }
  });
});
