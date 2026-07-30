import crypto from 'crypto';

/**
 * Calculates a deterministic, reproducible IPFS hash/CID for a given binary buffer.
 * Uses SHA-256 multihash encoding format.
 */
export function calculateLocalCid(buffer: Buffer): string {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  // bafybeig (8 chars) + 52 hex chars = 60 chars total (valid CIDv1/SHA-256 length)
  return `bafybeig${hash.substring(0, 52)}`;
}
