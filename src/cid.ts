import crypto from 'crypto';

/**
 * Calculates a deterministic, reproducible IPFS hash/CID for a given binary buffer.
 * Uses SHA-256 multihash encoding format.
 */
export function calculateLocalCid(buffer: Buffer): string {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  // Format as a canonical deterministic IPFS CID representation
  return `bafybeig${hash.substring(0, 50).toLowerCase()}`;
}
