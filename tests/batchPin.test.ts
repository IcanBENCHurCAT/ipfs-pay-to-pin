import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { handleBatchPin, BatchPinConfig } from '../src/batchPin.js';
import { globalFileQueue } from '../src/queue.js';

describe('handleBatchPin Unit Tests', () => {
  const defaultConfig: BatchPinConfig = {
    maxFiles: 5,
    maxBytes: 1024 * 1024, // 1MB
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path & Processing', () => {
    it('successfully processes all files in batch and returns 201 status', async () => {
      const mockQueueItem1 = {
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        gatewayUrl: 'https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        expires_at: 1735689600000, // 2025-01-01T00:00:00.000Z
      };
      const mockQueueItem2 = {
        cid: 'bafybeicg24y5vbf3qtzfvx6hh2q77x43l3g45y4z5t3o2q5h5i5y5i5y5i',
        gatewayUrl: 'https://ipfs.io/ipfs/bafybeicg24y5vbf3qtzfvx6hh2q77x43l3g45y4z5t3o2q5h5i5y5i5y5i',
        expires_at: 1735689600000,
      };

      const addJobSpy = vi.spyOn(globalFileQueue, 'addJob')
        .mockResolvedValueOnce(mockQueueItem1 as any)
        .mockResolvedValueOnce(mockQueueItem2 as any);

      const files = [
        { filename: 'file1.txt', data: Buffer.from('hello').toString('base64') },
        { filename: 'file2.txt', data: Buffer.from('world').toString('base64') },
      ];

      const webhookUrl = 'https://example.com/webhook';
      const result = await handleBatchPin(files, defaultConfig, webhookUrl);

      expect(result.statusCode).toBe(201);
      expect(result.response).toEqual({
        pins: [
          {
            cid: mockQueueItem1.cid,
            gateway_url: mockQueueItem1.gatewayUrl,
            expires_at: new Date(mockQueueItem1.expires_at).toISOString(),
          },
          {
            cid: mockQueueItem2.cid,
            gateway_url: mockQueueItem2.gatewayUrl,
            expires_at: new Date(mockQueueItem2.expires_at).toISOString(),
          },
        ],
        total: 2,
        succeeded: 2,
        failed: 0,
      });

      expect(addJobSpy).toHaveBeenCalledTimes(2);
      expect(addJobSpy).toHaveBeenNthCalledWith(
        1,
        'file1.txt',
        expect.any(Buffer),
        { webhookUrl }
      );
      expect(addJobSpy).toHaveBeenNthCalledWith(
        2,
        'file2.txt',
        expect.any(Buffer),
        { webhookUrl }
      );
    });

    it('returns 207 Multi-Status when some items fail during pinning', async () => {
      const mockQueueItem = {
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        gatewayUrl: 'https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        expires_at: 1735689600000,
      };

      vi.spyOn(globalFileQueue, 'addJob')
        .mockResolvedValueOnce(mockQueueItem as any)
        .mockRejectedValueOnce(new Error('Pinning service unavailable'));

      const files = [
        { filename: 'file1.txt', data: Buffer.from('hello').toString('base64') },
        { filename: 'file2.txt', data: Buffer.from('world').toString('base64') },
      ];

      const result = await handleBatchPin(files, defaultConfig);

      expect(result.statusCode).toBe(207);
      expect(result.response).toEqual({
        pins: [
          {
            cid: mockQueueItem.cid,
            gateway_url: mockQueueItem.gatewayUrl,
            expires_at: new Date(mockQueueItem.expires_at).toISOString(),
          },
          {
            filename: 'file2.txt',
            error: 'Pinning service unavailable',
          },
        ],
        total: 2,
        succeeded: 1,
        failed: 1,
      });
    });

    it('handles unexpected crashes or promise rejections in processing', async () => {
      // Force a rejection that is not caught by processSingleFile internally (or simulated unexpected crash)
      vi.spyOn(globalFileQueue, 'addJob').mockImplementation(() => {
        return Promise.reject({ reason: 'Fatal error without Error instance' });
      });

      const files = [
        { filename: 'crash.txt', data: Buffer.from('test').toString('base64') },
      ];

      const result = await handleBatchPin(files, defaultConfig);

      expect(result.statusCode).toBe(207);
      expect(result.response.succeeded).toBe(0);
      expect(result.response.failed).toBe(1);
      expect(result.response.pins[0]).toEqual({
        filename: 'crash.txt',
        error: 'Unknown pinning error.',
      });
    });
  });

  describe('Validation & Edge Cases', () => {
    it('returns 422 when input payload is not an array', async () => {
      const result = await handleBatchPin('not-an-array' as any, defaultConfig);
      expect(result.statusCode).toBe(422);
      expect(result.response).toEqual({ pins: [], total: 0, succeeded: 0, failed: 0 });
    });

    it('returns 422 when input array is empty', async () => {
      const result = await handleBatchPin([], defaultConfig);
      expect(result.statusCode).toBe(422);
      expect(result.response).toEqual({ pins: [], total: 0, succeeded: 0, failed: 0 });
    });

    it('returns 400 when file count exceeds maxFiles limit', async () => {
      const config = { ...defaultConfig, maxFiles: 2 };
      const files = [
        { filename: 'f1.txt', data: 'aGVsbG8=' },
        { filename: 'f2.txt', data: 'aGVsbG8=' },
        { filename: 'f3.txt', data: 'aGVsbG8=' },
      ];

      const result = await handleBatchPin(files, config);
      expect(result.statusCode).toBe(400);
      expect(result.response).toEqual({ pins: [], total: 0, succeeded: 0, failed: 0 });
    });

    it('returns 422 when an item is invalid or not an object', async () => {
      const files = [null];
      const result = await handleBatchPin(files as any, defaultConfig);
      expect(result.statusCode).toBe(422);
      expect(result.response).toEqual({ pins: [], total: 0, succeeded: 0, failed: 0 });
    });

    it('returns 422 when filename is missing or non-string or empty', async () => {
      const files = [{ filename: '   ', data: 'aGVsbG8=' }];
      const result = await handleBatchPin(files, defaultConfig);
      expect(result.statusCode).toBe(422);
    });

    it('returns 422 when data is missing or empty', async () => {
      const files = [{ filename: 'test.txt', data: '' }];
      const result = await handleBatchPin(files, defaultConfig);
      expect(result.statusCode).toBe(422);
    });

    it('returns 400 when total batch size exceeds maxBytes limit', async () => {
      const config = { ...defaultConfig, maxBytes: 10 }; // 10 bytes limit
      // 'aGVsbG8gd29ybGQ=' decodes to 'hello world' (11 bytes)
      const files = [{ filename: 'big.txt', data: Buffer.from('hello world').toString('base64') }];

      const result = await handleBatchPin(files, config);
      expect(result.statusCode).toBe(400);
      expect(result.response).toEqual({ pins: [], total: 0, succeeded: 0, failed: 0 });
    });
  });
});
