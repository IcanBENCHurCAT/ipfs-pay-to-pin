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
