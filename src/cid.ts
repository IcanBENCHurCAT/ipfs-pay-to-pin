import crypto from 'crypto';

/**
 * Base32 RFC4648 lowercase encoding (RFC 4648 alphabet: a-z, 2-7)
 */
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function encodeVarint(val: number): number[] {
  const res: number[] = [];
  let n = val;
  while (n >= 0x80) {
    res.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  res.push(n & 0x7f);
  return res;
}

/**
 * Calculates the exact deterministic IPFS UnixFS v1 CID (dag-pb / SHA-256)
 * for a given file binary buffer.
 * Matches standard IPFS & Pinata single-block UnixFS CID outputs.
 */
export function calculateLocalCid(buffer: Buffer): string {
  // 1. Construct UnixFS Data protobuf message:
  //    Type = File (2) [0x08, 0x02]
  //    Data = buffer   [0x12, varint(len), ...buffer]
  //    filesize = len  [0x18, varint(len)]
  const typeBytes = Buffer.from([0x08, 0x02]);
  const dataHeader = Buffer.from([0x12, ...encodeVarint(buffer.length)]);
  const filesizeBytes = Buffer.from([0x18, ...encodeVarint(buffer.length)]);
  const unixFsData = Buffer.concat([typeBytes, dataHeader, buffer, filesizeBytes]);

  // 2. Wrap UnixFS Data inside PBNode protobuf message:
  //    Data = unixFsData [0x0a, varint(len), ...unixFsData]
  const pbNodeHeader = Buffer.from([0x0a, ...encodeVarint(unixFsData.length)]);
  const pbNode = Buffer.concat([pbNodeHeader, unixFsData]);

  // 3. Compute SHA-256 digest of PBNode
  const sha256Hash = crypto.createHash('sha256').update(pbNode).digest();

  // 4. Construct CIDv1 bytes:
  //    multibase prefix: 'b' (base32)
  //    version: 0x01 (CIDv1)
  //    codec: 0x70 (dag-pb)
  //    multihash algorithm: 0x12 (sha2-256)
  //    multihash length: 0x20 (32 bytes)
  const cidRawBytes = Buffer.concat([Buffer.from([0x01, 0x70, 0x12, 0x20]), sha256Hash]);

  // 5. Encode with multibase prefix 'b'
  return 'b' + base32Encode(cidRawBytes);
}
