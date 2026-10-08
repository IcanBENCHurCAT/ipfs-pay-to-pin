import { describe, it, expect } from 'vitest';
import { decodeBase64, handleBatchPin, BatchPinConfig } from '../src/batchPin.js';

describe('batchPin — decodeBase64 & payload validation', () => {
  it('successfully decodes valid base64 strings within size limit', () => {
    const originalText = 'Hello World! IPFS Pay-to-Pin Gateway';
    const base64Data = Buffer.from(originalText).toString('base64');

    const decoded = decodeBase64(base64Data, 1024);
    expect(decoded.toString('utf-8')).toBe(originalText);
  });

  it('rejects base64 payload exceeding custom maxBytes before Buffer allocation', () => {
    const largeData = Buffer.alloc(100, 'a').toString('base64');

    expect(() => decodeBase64(largeData, 50)).toThrowError(
      /File payload size \(\d+ bytes\) exceeds maximum allowed limit of 50 bytes/
    );
  });

  it('throws error for invalid base64 data', () => {
    const invalidBase64 = '!!!NotValidBase64!!!';
    expect(() => decodeBase64(invalidBase64, 1024)).toThrowError(
      'Invalid base64 encoding in file data.'
    );
  });

  it('handleBatchPin enforces payload size limits on batch items', async () => {
    const config: BatchPinConfig = {
      maxFiles: 5,
      maxBytes: 100,
    };

    const oversizedData = Buffer.alloc(150, 'x').toString('base64');
    const files = [
      {
        filename: 'oversized.bin',
        data: oversizedData,
      },
    ];

    const result = await handleBatchPin(files, config);
    expect(result.statusCode).toBe(400);
    expect(result.response.total).toBe(0);
  });
});
