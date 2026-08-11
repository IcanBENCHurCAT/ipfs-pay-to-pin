import { describe, it, expect } from 'vitest';
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
