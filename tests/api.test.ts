import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { globalFileQueue } from '../src/queue.js';
import { paymentMiddleware } from '@x402/hono';

// Mock x402 middleware since we don't want to actually require payments in testing the endpoints logic
vi.mock('@x402/hono', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        paymentMiddleware: vi.fn().mockImplementation(() => {
            return async (c: any, next: any) => {
                if (c.req.method === 'GET' || c.req.header('x-test-bypass-payment') === 'true') {
                    return next();
                }
                return c.json({ error: "Payment required" }, 402, { 'PAYMENT-REQUIRED': 'challenge-string' });
            };
        })
    };
});

// Import app after mocks
import app from '../src/index.js';

describe('API Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (globalFileQueue as any).itemsCache = [];
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('T008: POST /api/v1/pin returns retention metadata payload', async () => {
        const payload = {
            filename: 'test.txt',
            data: Buffer.from('hello').toString('base64')
        };
        
        vi.spyOn(globalFileQueue, 'addJob').mockResolvedValue({
            id: 'job_123',
            filename: 'test.txt',
            cid: 'mock-cid-123',
            filePath: '/tmp/queue/mock-cid-123',
            status: 'PENDING',
            retryCount: 0,
            createdAt: Date.now(),
            gatewayUrl: 'https://ipfs.io/ipfs/mock-cid-123',
            sizeBytes: 5,
            pinned_at: Date.now(),
            expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000,
            ttl_days: 365,
            renewalsCount: 0
        });

        const res = await app.request('/api/v1/pin', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-test-bypass-payment': 'true'
            },
            body: JSON.stringify(payload)
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.cid).toBe('mock-cid-123');
        expect(data.pinned_at).toBeDefined();
        expect(data.expires_at).toBeDefined();
        expect(data.ttl_days).toBe(365);
        expect(data.renewal_url).toBe('/api/v1/renew');
    });

    it('T012: POST /api/v1/renew extends expiration', async () => {
        vi.spyOn(globalFileQueue, 'findByCid').mockResolvedValue({
            id: 'job_123',
            filename: 'test.txt',
            cid: 'mock-cid-123',
            filePath: '/tmp/queue/mock-cid-123',
            status: 'PINNED',
            retryCount: 0,
            createdAt: Date.now(),
            gatewayUrl: 'https://ipfs.io/ipfs/mock-cid-123',
            sizeBytes: 5,
            pinned_at: Date.now(),
            expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000,
            ttl_days: 365,
            renewalsCount: 0
        });

        vi.spyOn(globalFileQueue, 'renewPin').mockResolvedValue({
            id: 'job_123',
            filename: 'test.txt',
            cid: 'mock-cid-123',
            filePath: '/tmp/queue/mock-cid-123',
            status: 'PINNED',
            retryCount: 0,
            createdAt: Date.now(),
            gatewayUrl: 'https://ipfs.io/ipfs/mock-cid-123',
            sizeBytes: 5,
            pinned_at: Date.now(),
            expires_at: Date.now() + 2 * 365 * 24 * 60 * 60 * 1000,
            ttl_days: 365,
            renewalsCount: 1
        });

        const payload = { cid: 'mock-cid-123' };
        
        const res = await app.request('/api/v1/renew', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-test-bypass-payment': 'true'
            },
            body: JSON.stringify(payload)
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.cid).toBe('mock-cid-123');
        expect(data.expires_at).toBeDefined();
        expect(data.renewals_count).toBe(1);
    });

    it('T017: GET /api/v1/pin/:cid returns retention status', async () => {
        vi.spyOn(globalFileQueue, 'getPinStatus').mockResolvedValue({
            pinned_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            days_remaining: 365,
            is_active: true,
            ttl_days: 365,
            renewals_count: 0,
            renewal_url: '/api/v1/renew'
        });

        const res = await app.request('/api/v1/pin/mock-cid-123');
        
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.is_active).toBe(true);
        expect(data.days_remaining).toBe(365);
    });
});
