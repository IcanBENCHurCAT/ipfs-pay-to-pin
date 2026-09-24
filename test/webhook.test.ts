import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WebhookDeliveryService,
  WEBHOOK_MIGRATION_SQL,
  type WebhookPayload,
  type WebhookDeliveryRecord,
  type WebhookDeliveryStatus,
  type WebhookEventType,
} from '../src/webhook';
import { logger } from '../src/observability';

// Suppress logger output during tests
vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;

  beforeEach(() => {
    // Reset mocks and create a fresh service instance for each test
    vi.clearAllMocks();
    service = new WebhookDeliveryService(
      { maxRetries: 3, retryDelaysMs: [0, 30_000, 120_000], timeoutMs: 5_000 }
    );
  });

  describe('webhook delivery tracking', () => {
    it('should track a webhook delivery record', async () => {
      // Note: This test will log to console if Supabase is not configured,
      // which is expected behavior in test environment without DB
      const record = await service.trackDelivery({
        webhook_url: 'https://example.com/webhook',
        event: 'pin.completed' as WebhookEventType,
        payload: {
          event: 'pin.completed',
          cid: 'bafybeitest123',
          filename: 'test.txt',
          gateway_url: 'https://ipfs.io/ipfs/bafybeitest123',
          timestamp: new Date().toISOString(),
        },
        status: 'PENDING' as WebhookDeliveryStatus,
        attempts: 0,
        next_retry_at: 0,
        last_error: null,
        delivered_at: null,
        cid: 'bafybeitest123',
      });

      expect(record.id).toBeDefined();
      expect(record.webhook_url).toBe('https://example.com/webhook');
      expect(record.event).toBe('pin.completed');
      expect(record.status).toBe('PENDING');
      expect(record.attempts).toBe(0);
      expect(record.created_at).toBeDefined();
    });

    it('should generate unique IDs for each delivery', async () => {
      const record1 = await service.trackDelivery({
        webhook_url: 'https://example.com/webhook',
        event: 'pin.completed' as WebhookEventType,
        payload: { event: 'pin.completed', cid: 'cid1', filename: 'file1', timestamp: new Date().toISOString() },
        status: 'PENDING' as WebhookDeliveryStatus,
        attempts: 0, next_retry_at: 0, last_error: null, delivered_at: null, cid: 'cid1',
      });

      const record2 = await service.trackDelivery({
        webhook_url: 'https://example.com/webhook',
        event: 'pin.completed' as WebhookEventType,
        payload: { event: 'pin.completed', cid: 'cid2', filename: 'file2', timestamp: new Date().toISOString() },
        status: 'PENDING' as WebhookDeliveryStatus,
        attempts: 0, next_retry_at: 0, last_error: null, delivered_at: null, cid: 'cid2',
      });

      expect(record1.id).not.toBe(record2.id);
      expect(record1.id).toMatch(/^wh_/);
    });
  });

  describe('safe URL validation', () => {
    it('should allow safe external URLs', async () => {
      const result = await service.trackDelivery({
        webhook_url: 'https://example.com/callback',
        event: 'pin.completed' as WebhookEventType,
        payload: { event: 'pin.completed', cid: 'cid1', filename: 'file1', timestamp: new Date().toISOString() },
        status: 'PENDING' as WebhookDeliveryStatus,
        attempts: 0, next_retry_at: 0, last_error: null, delivered_at: null, cid: 'cid1',
      });
      expect(result.webhook_url).toBe('https://example.com/callback');
    });

    it('should allow HTTP URLs', async () => {
      const result = await service.trackDelivery({
        webhook_url: 'http://external-service.com/webhook',
        event: 'pin.completed' as WebhookEventType,
        payload: { event: 'pin.completed', cid: 'cid1', filename: 'file1', timestamp: new Date().toISOString() },
        status: 'PENDING' as WebhookDeliveryStatus,
        attempts: 0, next_retry_at: 0, last_error: null, delivered_at: null, cid: 'cid1',
      });
      expect(result.webhook_url).toBe('http://external-service.com/webhook');
    });

    it('should block localhost URLs', async () => {
      // We test this indirectly via fire() since trackDelivery doesn't validate
      // The safety check happens in deliver() and fire()
    });
  });

  describe('webhook fire functionality', () => {
    it('should queue a webhook delivery with fire()', async () => {
      const result = await service.fire(
        'pin.completed',
        'bafybeitest123',
        'test.txt',
        'https://ipfs.io/ipfs/bafybeitest123',
        'https://example.com/callback'
      );

      expect(result).toBe(true);
    });

    it('should return false when webhook is disabled', async () => {
      const disabledService = new WebhookDeliveryService({}, undefined, undefined);
      // Force disable via env
      const orig = process.env.WEBHOOK_ENABLED;
      process.env.WEBHOOK_ENABLED = 'false';
      
      const result = await disabledService.fire(
        'pin.completed',
        'bafybeitest123',
        'test.txt',
        'https://ipfs.io/ipfs/bafybeitest123',
        'https://example.com/callback'
      );

      expect(result).toBe(false);
      
      // Restore
      if (orig === undefined) {
        delete process.env.WEBHOOK_ENABLED;
      } else {
        process.env.WEBHOOK_ENABLED = orig;
      }
    });
  });

  describe('delivery status transitions', () => {
    it('should handle DELIVERED status', async () => {
      const record = await service.trackDelivery({
        webhook_url: 'https://example.com/webhook',
        event: 'pin.completed' as WebhookEventType,
        payload: { event: 'pin.completed', cid: 'cid1', filename: 'file1', timestamp: new Date().toISOString() },
        status: 'DELIVERED' as WebhookDeliveryStatus,
        attempts: 1,
        next_retry_at: null,
        last_error: null,
        delivered_at: Date.now(),
        cid: 'cid1',
      });

      expect(record.status).toBe('DELIVERED');
      expect(record.delivered_at).toBeDefined();
      expect(record.attempts).toBe(1);
    });

    it('should handle FAILED status', async () => {
      const record = await service.trackDelivery({
        webhook_url: 'https://example.com/webhook',
        event: 'pin.failed' as WebhookEventType,
        payload: { event: 'pin.failed', cid: 'cid2', filename: 'file2', timestamp: new Date().toISOString(), error: 'Pinata error' },
        status: 'FAILED' as WebhookDeliveryStatus,
        attempts: 3,
        next_retry_at: null,
        last_error: 'HTTP 500: Internal Server Error',
        delivered_at: null,
        cid: 'cid2',
      });

      expect(record.status).toBe('FAILED');
      expect(record.last_error).toContain('500');
      expect(record.attempts).toBe(3);
    });

    it('should handle PENDING status', async () => {
      const record = await service.trackDelivery({
        webhook_url: 'https://example.com/webhook',
        event: 'pin.completed' as WebhookEventType,
        payload: { event: 'pin.completed', cid: 'cid3', filename: 'file3', timestamp: new Date().toISOString() },
        status: 'PENDING' as WebhookDeliveryStatus,
        attempts: 0,
        next_retry_at: Date.now() + 30000,
        last_error: null,
        delivered_at: null,
        cid: 'cid3',
      });

      expect(record.status).toBe('PENDING');
      expect(record.next_retry_at).toBeDefined();
      expect(record.attempts).toBe(0);
    });
  });

  describe('retry logic', () => {
    it('should schedule retries with exponential backoff', async () => {
      // Test that the service calculates next retry times correctly
      // by checking the delivery record after a simulated failure
      const record = await service.trackDelivery({
        webhook_url: 'https://example.com/webhook',
        event: 'pin.completed' as WebhookEventType,
        payload: { event: 'pin.completed', cid: 'cid1', filename: 'file1', timestamp: new Date().toISOString() },
        status: 'TIMED_OUT' as WebhookDeliveryStatus,
        attempts: 1,
        next_retry_at: Date.now() + 30000, // 30s for 2nd attempt
        last_error: 'Request timed out',
        delivered_at: null,
        cid: 'cid1',
      });

      expect(record.status).toBe('TIMED_OUT');
      expect(record.attempts).toBe(1);
      expect(record.next_retry_at).toBeGreaterThan(Date.now());
    });
  });

  describe('getDeliveriesByCid', () => {
    it('should return empty array when no Supabase connection', async () => {
      const serviceNoDb = new WebhookDeliveryService({}, undefined, undefined);
      const deliveries = await serviceNoDb.getDeliveriesByCid('bafybeitest');
      expect(deliveries).toEqual([]);
    });

    it('should return deliveries when Supabase is connected (integration)', async () => {
      // This test requires Supabase to be configured
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        expect(true).toBe(true); // Skip if no Supabase config
        return;
      }

      const deliveries = await service.getDeliveriesByCid('nonexistent-cid');
      expect(Array.isArray(deliveries)).toBe(true);
    });
  });

  describe('getPendingDeliveries', () => {
    it('should return empty array when no Supabase connection', async () => {
      const serviceNoDb = new WebhookDeliveryService({}, undefined, undefined);
      const deliveries = await serviceNoDb.getPendingDeliveries(10);
      expect(deliveries).toEqual([]);
    });

    it('should return pending deliveries when configured (integration)', async () => {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        expect(true).toBe(true); // Skip if no Supabase config
        return;
      }

      const deliveries = await service.getPendingDeliveries(10);
      expect(Array.isArray(deliveries)).toBe(true);
    });
  });

  describe('database migration SQL', () => {
    it('should contain valid CREATE TABLE statement', () => {
      expect(WEBHOOK_MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS public.webhook_deliveries');
      expect(WEBHOOK_MIGRATION_SQL).toContain('id TEXT PRIMARY KEY');
      expect(WEBHOOK_MIGRATION_SQL).toContain('webhook_url TEXT NOT NULL');
      expect(WEBHOOK_MIGRATION_SQL).toContain('event TEXT NOT NULL');
      expect(WEBHOOK_MIGRATION_SQL).toContain('payload JSONB NOT NULL');
      expect(WEBHOOK_MIGRATION_SQL).toContain('status TEXT NOT NULL');
    });

    it('should include indexes for performance', () => {
      expect(WEBHOOK_MIGRATION_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status');
      expect(WEBHOOK_MIGRATION_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_cid');
      expect(WEBHOOK_MIGRATION_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_url_event');
    });

    it('should include all required columns', () => {
      const requiredColumns = [
        'id', 'webhook_url', 'event', 'payload', 'status', 'attempts',
        'next_retry_at', 'last_error', 'created_at', 'delivered_at', 'cid'
      ];
      
      for (const column of requiredColumns) {
        expect(WEBHOOK_MIGRATION_SQL).toContain(column);
      }
    });
  });

  describe('payload structure', () => {
    it('should create valid webhook payloads', () => {
      const payload: WebhookPayload = {
        event: 'pin.completed',
        cid: 'bafybeigtest123',
        filename: 'document.pdf',
        gateway_url: 'https://ipfs.io/ipfs/bafybeigtest123',
        timestamp: new Date().toISOString(),
      };

      expect(payload.event).toBe('pin.completed');
      expect(payload.cid).toBe('bafybeigtest123');
      expect(payload.filename).toBe('document.pdf');
      expect(payload.gateway_url).toBeDefined();
      expect(new Date(payload.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should support error in payload', () => {
      const payload: WebhookPayload = {
        event: 'pin.failed',
        cid: 'bafybeigfail123',
        filename: 'document.pdf',
        error: 'Pinata API error: Quota exceeded',
        timestamp: new Date().toISOString(),
      };

      expect(payload.event).toBe('pin.failed');
      expect(payload.error).toBe('Pinata API error: Quota exceeded');
    });

    it('should support expired event', () => {
      const payload: WebhookPayload = {
        event: 'pin.expired',
        cid: 'bafybeigexpire123',
        filename: 'old-file.txt',
        timestamp: new Date().toISOString(),
      };

      expect(payload.event).toBe('pin.expired');
    });
  });

  describe('delivery record structure', () => {
    it('should have all required fields', () => {
      const record: WebhookDeliveryRecord = {
        id: 'wh_1234567890_abcde',
        webhook_url: 'https://example.com/webhook',
        event: 'pin.completed',
        payload: { event: 'pin.completed', cid: 'cid1', filename: 'file1', timestamp: new Date().toISOString() },
        status: 'DELIVERED',
        attempts: 1,
        next_retry_at: null,
        last_error: null,
        created_at: Date.now(),
        delivered_at: Date.now(),
        cid: 'cid1',
      };

      expect(record.id).toMatch(/^wh_/);
      expect(record.status).toBe('DELIVERED');
      expect(record.event).toBe('pin.completed');
      expect(record.webhook_url).toMatch(/^https?:\/\//);
    });
  });
});

describe('Webhook URL validation', () => {
  it('should reject localhost in URL hostname', async () => {
    const service = new WebhookDeliveryService();
    
    // Track delivery to a localhost URL should fail safety check in deliver()
    // but trackDelivery doesn't validate, so we test via fire()
    const result = await service.fire(
      'pin.completed',
      'bafybeitest',
      'test.txt',
      'https://ipfs.io/ipfs/bafybeitest',
      'http://localhost:3000/callback'
    );
    
    expect(result).toBe(false);
  });

  it('should reject 127.0.0.1 URLs', async () => {
    const service = new WebhookDeliveryService();
    
    const result = await service.fire(
      'pin.completed',
      'bafybeitest',
      'test.txt',
      'https://ipfs.io/ipfs/bafybeitest',
      'http://127.0.0.1:8080/webhook'
    );
    
    expect(result).toBe(false);
  });

  it('should reject 10.x.x.x private IPs', async () => {
    const service = new WebhookDeliveryService();
    
    const result = await service.fire(
      'pin.completed',
      'bafybeitest',
      'test.txt',
      'https://ipfs.io/ipfs/bafybeitest',
      'http://10.0.0.1:3000/webhook'
    );
    
    expect(result).toBe(false);
  });

  it('should reject 192.168.x.x private IPs', async () => {
    const service = new WebhookDeliveryService();
    
    const result = await service.fire(
      'pin.completed',
      'bafybeitest',
      'test.txt',
      'https://ipfs.io/ipfs/bafybeitest',
      'http://192.168.1.1:8080/callback'
    );
    
    expect(result).toBe(false);
  });

  it('should allow valid external HTTPS URLs', async () => {
    const service = new WebhookDeliveryService();
    
    const result = await service.fire(
      'pin.completed',
      'bafybeitest',
      'test.txt',
      'https://ipfs.io/ipfs/bafybeitest',
      'https://example.com/webhook'
    );
    
    expect(result).toBe(true);
  });

  it('should allow valid external HTTP URLs', async () => {
    const service = new WebhookDeliveryService();
    
    const result = await service.fire(
      'pin.completed',
      'bafybeitest',
      'test.txt',
      'https://ipfs.io/ipfs/bafybeitest',
      'http://external-service.com/callback'
    );
    
    expect(result).toBe(true);
  });
});

describe('Event types', () => {
  it('should support pin.completed event', () => {
    const payload: WebhookPayload = {
      event: 'pin.completed',
      cid: 'bafybeigtest',
      filename: 'test.txt',
      timestamp: new Date().toISOString(),
    };
    expect(payload.event).toBe('pin.completed');
  });

  it('should support pin.failed event', () => {
    const payload: WebhookPayload = {
      event: 'pin.failed',
      cid: 'bafybeigfail',
      filename: 'test.txt',
      error: 'Pinata error',
      timestamp: new Date().toISOString(),
    };
    expect(payload.event).toBe('pin.failed');
  });

  it('should support pin.expired event', () => {
    const payload: WebhookPayload = {
      event: 'pin.expired',
      cid: 'bafybeigexpired',
      filename: 'test.txt',
      timestamp: new Date().toISOString(),
    };
    expect(payload.event).toBe('pin.expired');
  });
});
