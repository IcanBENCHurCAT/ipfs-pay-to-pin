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
});
