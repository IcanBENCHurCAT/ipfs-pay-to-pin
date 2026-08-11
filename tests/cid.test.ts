import { describe, it, expect } from 'vitest';
import { calculateLocalCid } from '../src/cid.js';

describe('calculateLocalCid', () => {
  // Happy paths with known standard IPFS CIDv1 values
  it('T018: calculates the correct CID for an empty buffer', () => {
    const buffer = Buffer.alloc(0);
    const cid = calculateLocalCid(buffer);
    expect(cid).toBe('bafybeiftu27piztiu5bfxbvhqsbppgtseykyfot6wtlrrzeuzya6zrgpky');
  });

  it('T019: calculates the correct CID for "hello"', () => {
    const buffer = Buffer.from('hello');
    const cid = calculateLocalCid(buffer);
    expect(cid).toBe('bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq');
  });

  it('T020: calculates the correct CID for "hello world"', () => {
    const buffer = Buffer.from('hello world');
    const cid = calculateLocalCid(buffer);
    expect(cid).toBe('bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa');
  });

  it('T021: calculates the correct CID for multi-byte Unicode characters', () => {
    const buffer = Buffer.from('🚀');
    const cid = calculateLocalCid(buffer);
    expect(cid).toBe('bafybeiec45euhijowabn557icepcighg4oqm6p67pyrnnudwttddhums6m');
  });

  // Edge cases and format characteristics
  it('T022: output format characteristics', () => {
    const buffer = Buffer.from('test string');
    const cid = calculateLocalCid(buffer);

    // CIDv1 length should be exactly 59 characters (1 for 'b' + 58 for base32)
    expect(cid.length).toBe(59);

    // Starts with 'b'
    expect(cid.startsWith('b')).toBe(true);

    // Base32 portion should only contain lowercase a-z and 2-7
    const base32Part = cid.slice(1);
    expect(base32Part).toMatch(/^[a-z2-7]+$/);
  });

  it('T023: is strictly deterministic', () => {
    const buffer = Buffer.from('some deterministic content');
    const cid1 = calculateLocalCid(buffer);
    const cid2 = calculateLocalCid(buffer);
    expect(cid1).toBe(cid2);
  });

  // Boundary conditions for varint encodings
  // 127 (7-bit boundary: 1 byte varint), 128 (8-bit boundary: 2 bytes varint)
  // 16383 (14-bit boundary: 2 bytes varint), 16384 (15-bit boundary: 3 bytes varint)
  const boundarySizes = [127, 128, 16383, 16384, 2097151, 2097152];
  boundarySizes.forEach((size) => {
    it(`T024: handles varint boundary size ${size} correctly`, () => {
      const buffer = Buffer.alloc(size, 'a');
      const cid = calculateLocalCid(buffer);

      expect(cid.length).toBe(59);
      expect(cid.startsWith('b')).toBe(true);
      expect(cid.slice(1)).toMatch(/^[a-z2-7]+$/);
    });
  });

  // Performance and larger payload handling
  it('T025: calculates CID for a larger buffer (5MB) efficiently', () => {
    // Generate a 5MB buffer of 'x'
    const fiveMegabytes = 5 * 1024 * 1024;
    const buffer = Buffer.alloc(fiveMegabytes, 'x');

    const startTime = performance.now();
    const cid = calculateLocalCid(buffer);
    const duration = performance.now() - startTime;

    expect(cid.length).toBe(59);
    expect(cid.startsWith('b')).toBe(true);
    // Large calculation should be reasonably fast (typically under 100ms)
    expect(duration).toBeLessThan(500);
  });
});
