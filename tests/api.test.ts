import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { globalFileQueue } from '../src/queue.js';
import { paymentMiddleware } from '@x402/hono';
import * as refundModule from '../src/refund.js';
import { config } from '../src/config.js';

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
        expect(data.renewal_url).toBe('/api/v1/renew?cid=mock-cid-123');
    });

    it('T012: POST /api/v1/renew extends expiration', async () => {
        vi.spyOn(globalFileQueue, 'findAnyByCid').mockResolvedValue({
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
            renewal_url: '/api/v1/renew?cid=mock-cid-123'
        });

        const res = await app.request('/api/v1/pin/mock-cid-123');
        
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.is_active).toBe(true);
        expect(data.days_remaining).toBe(365);
    });

    it('T025: Unhandled server errors are sanitized via app.onError', async () => {
        vi.spyOn(globalFileQueue, 'getPinStatus').mockImplementationOnce(() => {
            throw new Error('Database connection failed or sensitive secret key: 0xSECRET123');
        });

        const res = await app.request('/api/v1/pin/trigger-error-cid');

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data).toEqual({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred.'
        });
        expect(JSON.stringify(data)).not.toContain('0xSECRET123');
        expect(JSON.stringify(data)).not.toContain('Database connection failed');
    });

    it('T026: OPTIONS and GET requests include CORS headers for allowed origin', async () => {
        const optionsRes = await app.request('/health', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://pay-to-pin.duckdns.org',
                'Access-Control-Request-Method': 'GET'
            }
        });
        expect(optionsRes.headers.get('access-control-allow-origin')).toBe('https://pay-to-pin.duckdns.org');

        const getRes = await app.request('/health', {
            method: 'GET',
            headers: {
                'Origin': 'https://pay-to-pin.duckdns.org'
            }
        });
        expect(getRes.headers.get('access-control-allow-origin')).toBe('https://pay-to-pin.duckdns.org');
    });

    it('T027: POST /api/v1/pin rejects oversized base64 payload with 413 Payload Too Large', async () => {
        // Construct a dummy base64 string whose calculated binary size exceeds 20MB
        // 20MB = 20,971,520 bytes. base64 string length for >20MB is >27,962,027 chars.
        // We simulate a large base64 string length using String.prototype.repeat without huge memory overhead in test:
        // 'A' repeated 28,000,000 times represents ~21MB binary payload.
        const oversizedBase64 = 'A'.repeat(28 * 1024 * 1024);

        const payload = {
            filename: 'large_file.bin',
            data: oversizedBase64
        };

        const res = await app.request('/api/v1/pin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-test-bypass-payment': 'true'
            },
            body: JSON.stringify(payload)
        });

        expect(res.status).toBe(413);
        const data = await res.json();
        expect(data).toEqual({
            error: 'Payload Too Large',
            message: 'File payload exceeds 20MB maximum limit.'
        });
    });

    it('T028: POST /api/v1/pin ignores client-spoofed x-payment-amount header during refund calculation', async () => {
        const originalEnableRefunds = config.enableAutomaticRefunds;
        config.enableAutomaticRefunds = true;

        const refundSpy = vi.spyOn(refundModule, 'initiateOnChainRefund').mockResolvedValue({
            success: true,
            txId: 'MOCK_REFUND_TX_123'
        });

        vi.spyOn(globalFileQueue, 'addJob').mockRejectedValue(new Error('Simulated queue storage failure'));

        // Payload with 100 bytes binary data -> Base64 encoded is ~136 chars
        const testData = Buffer.alloc(100, 'a').toString('base64');
        const payload = {
            filename: 'refund_test.txt',
            data: testData
        };

        const res = await app.request('/api/v1/pin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-test-bypass-payment': 'true',
                'x-payment-sender': 'ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY',
                'x-payment-amount': '999999999' // Attacker spoofing 999 USDC refund
            },
            body: JSON.stringify(payload)
        });

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.refund_initiated).toBe(true);
        expect(data.refund_tx_id).toBe('MOCK_REFUND_TX_123');

        // Expected refund for 100 bytes is 10000 + 100 * 0.02 = 10002 microUSDC, NOT 999999999
        expect(refundSpy).toHaveBeenCalledWith(expect.objectContaining({
            amountMicroUsdc: 10002,
            recipientAddress: 'ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY'
        }));

        config.enableAutomaticRefunds = originalEnableRefunds;
    });
});
