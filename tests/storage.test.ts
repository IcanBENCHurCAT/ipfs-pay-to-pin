import { describe, it, expect } from 'vitest';
import { validateContentType } from '../src/storage.js';

describe('validateContentType', () => {
  // Test short buffer allowance
  it('allows buffers with length < 4', () => {
    expect(validateContentType(Buffer.from('abc'))).toBe(true);
    expect(validateContentType(Buffer.alloc(0))).toBe(true);
  });

  // Test magic bytes signatures
  describe('Magic Bytes Signatures (Happy Paths)', () => {
    it('validates image/png', () => {
      // png signature starts with \x89PNG
      const pngBuffer = Buffer.from('\x89PNGsome_extra_data', 'latin1');
      expect(validateContentType(pngBuffer)).toBe(true);
    });

    it('validates image/jpeg', () => {
      // jpeg signature starts with \xFF\xD8\xFF
      const jpegBuffer = Buffer.from('\xFF\xD8\xFFsome_extra_data', 'latin1');
      expect(validateContentType(jpegBuffer)).toBe(true);
    });

    it('validates image/gif', () => {
      const gif1Buffer = Buffer.from('GIF87asome_data', 'latin1');
      const gif2Buffer = Buffer.from('GIF89asome_data', 'latin1');
      expect(validateContentType(gif1Buffer)).toBe(true);
      expect(validateContentType(gif2Buffer)).toBe(true);
    });

    it('validates image/webp', () => {
      const webpBuffer = Buffer.from('RIFF_webp_data', 'latin1');
      expect(validateContentType(webpBuffer)).toBe(true);
    });

    it('validates image/avif', () => {
      const avif1Buffer = Buffer.from('ftypavif_data', 'latin1');
      const avif2Buffer = Buffer.from('ftypmif1_data', 'latin1');
      expect(validateContentType(avif1Buffer)).toBe(true);
      expect(validateContentType(avif2Buffer)).toBe(true);
    });

    it('validates image/svg+xml', () => {
      const svgBuffer = Buffer.from('<svg width="100">...', 'latin1');
      const xmlBuffer = Buffer.from('<?xml version="1.0">...', 'latin1');
      expect(validateContentType(svgBuffer)).toBe(true);
      expect(validateContentType(xmlBuffer)).toBe(true);
    });

    it('validates application/pdf', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4', 'latin1');
      expect(validateContentType(pdfBuffer)).toBe(true);
    });

    it('validates application/zip', () => {
      const zipBuffer = Buffer.from('PK\x03\x04some_zip_data', 'latin1');
      expect(validateContentType(zipBuffer)).toBe(true);
    });

    it('validates application/gzip', () => {
      const gzipBuffer = Buffer.from('\x1F\x8Bsome_gzip_data', 'latin1');
      expect(validateContentType(gzipBuffer)).toBe(true);
    });

    it('validates video/mp4', () => {
      const mp4Buffer = Buffer.from('ftypmp4_data', 'latin1');
      expect(validateContentType(mp4Buffer)).toBe(true);
    });

    it('validates audio/mpeg', () => {
      const mp3_1 = Buffer.from('ID3_mp3_data', 'latin1');
      const mp3_2 = Buffer.from('\xFF\xFB_mp3_data', 'latin1');
      const mp3_3 = Buffer.from('\xFF\xF3_mp3_data', 'latin1');
      const mp3_4 = Buffer.from('\xFF\xF2_mp3_data', 'latin1');
      expect(validateContentType(mp3_1)).toBe(true);
      expect(validateContentType(mp3_2)).toBe(true);
      expect(validateContentType(mp3_3)).toBe(true);
      expect(validateContentType(mp3_4)).toBe(true);
    });

    it('validates audio/wav', () => {
      const wavBuffer = Buffer.from('RIFF_wav_data', 'latin1');
      expect(validateContentType(wavBuffer)).toBe(true);
    });

    it('validates audio/ogg', () => {
      const oggBuffer = Buffer.from('OggS_ogg_data', 'latin1');
      expect(validateContentType(oggBuffer)).toBe(true);
    });
  });

  // Test safe UTF-8 text files
  describe('Safe Text Content (UTF-8)', () => {
    it('validates plain text without null bytes', () => {
      const textBuffer = Buffer.from('Hello, this is a plain text file for pinning.');
      expect(validateContentType(textBuffer)).toBe(true);
    });

    it('rejects text containing null bytes in the first 512 bytes', () => {
      const badBuffer = Buffer.from('Hello\0World. This should be rejected as binary without valid magic bytes.');
      expect(validateContentType(badBuffer)).toBe(false);
    });
  });

  // Test negative/failure scenarios
  describe('Unsupported Binary Content (Negative Paths)', () => {
    it('rejects random binary payloads without valid magic signatures', () => {
      const randomBinary = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x00, 0xff]);
      expect(validateContentType(randomBinary)).toBe(false);
    });
  });
});
import { sanitizeFilename } from '../src/storage.js';

describe('sanitizeFilename', () => {
  it('handles empty or non-string inputs', () => {
    // @ts-expect-error - testing invalid JS types
    expect(sanitizeFilename(null)).toBe('file.bin');
    // @ts-expect-error - testing invalid JS types
    expect(sanitizeFilename(undefined)).toBe('file.bin');
    // @ts-expect-error - testing invalid JS types
    expect(sanitizeFilename(123)).toBe('file.bin');
    expect(sanitizeFilename('')).toBe('file.bin');
  });

  it('keeps valid standard names as is', () => {
    expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
    expect(sanitizeFilename('image-123_test.png')).toBe('image-123_test.png');
  });

  it('decodes URL-encoded characters correctly', () => {
    expect(sanitizeFilename('my%20document%20name.pdf')).toBe('my document name.pdf');
    expect(sanitizeFilename('%E2%98%85star.png')).toBe('star.png'); // non-ASCII star character is decoded then stripped
  });

  it('keeps raw name if URL decoding fails', () => {
    // Incomplete or invalid percent-encoding throws on decodeURIComponent
    expect(sanitizeFilename('test%G123.bin')).toBe('test%G123.bin');
  });

  it('removes non-ASCII characters', () => {
    expect(sanitizeFilename('hello★world.txt')).toBe('helloworld.txt');
    expect(sanitizeFilename('résumé.pdf')).toBe('rsum.pdf');
  });

  it('strips path components and directory traversals', () => {
    expect(sanitizeFilename('path/to/file.txt')).toBe('pathtofile.txt');
    expect(sanitizeFilename('..\\..\\etc\\passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('%2e%2e%2f%2e%2e%2fetc%2fpasswd')).toBe('etcpasswd');
    expect(sanitizeFilename('/etc/hosts')).toBe('etchosts');
  });

  it('cleans leading dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('hidden');
    expect(sanitizeFilename('...dotfile.txt')).toBe('dotfile.txt');
  });

  it('adds prefix to Windows reserved names', () => {
    expect(sanitizeFilename('CON.txt')).toBe('safe_CON.txt');
    expect(sanitizeFilename('aux')).toBe('safe_aux');
    expect(sanitizeFilename('PRN.tar.gz')).toBe('safe_PRN.tar.gz');
    expect(sanitizeFilename('com1.bin')).toBe('safe_com1.bin');
    expect(sanitizeFilename('lpt9')).toBe('safe_lpt9');
  });

  it('truncates filename to maximum of 200 characters', () => {
    const longName = 'a'.repeat(250) + '.txt';
    const sanitized = sanitizeFilename(longName);
    expect(sanitized.length).toBe(200);
    expect(sanitized).toBe('a'.repeat(200));
  });

  it('falls back to file.bin if the entire name is cleaned to nothing', () => {
    expect(sanitizeFilename('///')).toBe('file.bin');
    expect(sanitizeFilename('★')).toBe('file.bin');
    expect(sanitizeFilename('..')).toBe('file.bin');
  });
});
import { beforeEach, afterEach, vi } from 'vitest';
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
