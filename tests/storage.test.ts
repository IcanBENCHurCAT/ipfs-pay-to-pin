import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import fs from 'fs';
import { pinFileToStorage } from '../src/storage.js';

vi.mock('axios');

describe('pinFileToStorage Error Paths & Fallbacks', () => {
  const originalEnv = { ...process.env };
  let mkdirSpy: any;
  let writeFileSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as any);
    writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    mkdirSpy.mockRestore();
    writeFileSpy.mockRestore();
  });

  it('throws error when PINATA_JWT is missing and ALLOW_LOCAL_FALLBACK is false', async () => {
    delete process.env.PINATA_JWT;
    process.env.ALLOW_LOCAL_FALLBACK = 'false';

    const buffer = Buffer.from('test content');
    await expect(pinFileToStorage(buffer, 'test.txt')).rejects.toThrow(
      'PINATA_JWT environment variable is not configured.'
    );
  });

  it('uploads to Pinata successfully when PINATA_JWT is present', async () => {
    process.env.PINATA_JWT = 'mock-jwt-token';
    process.env.ALLOW_LOCAL_FALLBACK = 'false';

    const mockCid = 'bafybeigpinatacid';
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { IpfsHash: mockCid },
    });

    const buffer = Buffer.from('test content');
    const result = await pinFileToStorage(buffer, 'test.txt');

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(result.ipfs_cid).toBe(mockCid);
    expect(result.gateway_url).toBe(`https://ipfs.io/ipfs/${mockCid}`);
  });

  it('throws an error when Pinata fails and ALLOW_LOCAL_FALLBACK is false', async () => {
    process.env.PINATA_JWT = 'mock-jwt-token';
    process.env.ALLOW_LOCAL_FALLBACK = 'false';

    const apiError = new Error('Network timeout');
    vi.mocked(axios.post).mockRejectedValueOnce(apiError);

    const buffer = Buffer.from('test content');
    await expect(pinFileToStorage(buffer, 'test.txt')).rejects.toThrow(
      'Pinata upload failed: Network timeout'
    );
  });

  it('warns and falls back to local storage when Pinata fails and ALLOW_LOCAL_FALLBACK is true', async () => {
    process.env.PINATA_JWT = 'mock-jwt-token';
    process.env.ALLOW_LOCAL_FALLBACK = 'true';
    process.env.LOCAL_STORAGE_DIR = 'tmp/mock_test_storage';

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const apiError = new Error('API down');
    vi.mocked(axios.post).mockRejectedValueOnce(apiError);

    const buffer = Buffer.from('fallback content');
    const result = await pinFileToStorage(buffer, 'fallback.txt');

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Pinata API failed, falling back to local hash pinning in dev/test:',
      'API down'
    );
    expect(result.ipfs_cid).toBeDefined();
    expect(result.gateway_url).toBe(`https://ipfs.io/ipfs/${result.ipfs_cid}`);

    expect(mkdirSpy).toHaveBeenCalledWith('tmp/mock_test_storage', { recursive: true });
    expect(writeFileSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('falls back directly to local storage when PINATA_JWT is missing but ALLOW_LOCAL_FALLBACK is true', async () => {
    delete process.env.PINATA_JWT;
    process.env.ALLOW_LOCAL_FALLBACK = 'true';
    process.env.LOCAL_STORAGE_DIR = 'tmp/mock_test_storage_direct';

    const buffer = Buffer.from('direct fallback');
    const result = await pinFileToStorage(buffer, 'direct.txt');

    expect(axios.post).not.toHaveBeenCalled();
    expect(result.ipfs_cid).toBeDefined();
    expect(result.gateway_url).toBe(`https://ipfs.io/ipfs/${result.ipfs_cid}`);

    expect(mkdirSpy).toHaveBeenCalledWith('tmp/mock_test_storage_direct', { recursive: true });
    expect(writeFileSpy).toHaveBeenCalled();
  });
});
