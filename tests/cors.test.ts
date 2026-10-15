import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import app from '../src/index.js';
import { config } from '../src/config.js';

describe('CORS Middleware Configuration', () => {
  let originalCorsOrigin: string;

  beforeEach(() => {
    originalCorsOrigin = config.corsOrigin;
  });

  afterEach(() => {
    config.corsOrigin = originalCorsOrigin;
  });

  it('allows requests from default allowed origins when CORS_ORIGIN is not set', async () => {
    config.corsOrigin = '';
    const res = await app.request('/health', {
      method: 'GET',
      headers: {
        Origin: 'https://pay-to-pin.duckdns.org',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://pay-to-pin.duckdns.org');
  });

  it('rejects/omits Access-Control-Allow-Origin header for untrusted origins', async () => {
    config.corsOrigin = '';
    const res = await app.request('/health', {
      method: 'GET',
      headers: {
        Origin: 'https://malicious-website.com',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('handles OPTIONS preflight requests for allowed origins', async () => {
    const res = await app.request('/api/v1/pin', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  it('correctly parses and normalizes comma-separated CORS_ORIGIN values', async () => {
    config.corsOrigin = 'https://app.example.com/, http://localhost:8080/path, https://trusted.org';

    // Matched normalized origin (trailing slash removed)
    const res1 = await app.request('/health', {
      method: 'GET',
      headers: { Origin: 'https://app.example.com' },
    });
    expect(res1.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');

    // Matched origin with port
    const res2 = await app.request('/health', {
      method: 'GET',
      headers: { Origin: 'http://localhost:8080' },
    });
    expect(res2.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8080');

    // Reject unlisted origin
    const res3 = await app.request('/health', {
      method: 'GET',
      headers: { Origin: 'https://untrusted.com' },
    });
    expect(res3.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('safely ignores malformed or non-http(s) origin entries in CORS_ORIGIN', async () => {
    config.corsOrigin = 'invalid-domain-no-protocol, ftp://files.example.com, https://valid.com';

    const resValid = await app.request('/health', {
      method: 'GET',
      headers: { Origin: 'https://valid.com' },
    });
    expect(resValid.headers.get('Access-Control-Allow-Origin')).toBe('https://valid.com');

    const resInvalid = await app.request('/health', {
      method: 'GET',
      headers: { Origin: 'https://invalid-domain-no-protocol' },
    });
    expect(resInvalid.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('supports wildcard * CORS_ORIGIN setting when explicitly configured', async () => {
    config.corsOrigin = '*';

    const res = await app.request('/health', {
      method: 'GET',
      headers: { Origin: 'https://any-domain.com' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
