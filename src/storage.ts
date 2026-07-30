import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

export interface PinResult {
  ipfs_cid: string;
  gateway_url: string;
}

/** Sanitize filename: strip path components, limit length, allow only safe chars */
export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') return 'unnamed';
  // Strip any directory components (handles ../ traversal, URL-encoded paths, etc.)
  const base = name.replace(/[^\x20-\x7E]/g, '').replace(/\//g, '').replace(/\\/g, '');
  // Remove leading dots (handles .. and hidden files)
  const cleaned = base.replace(/^\.+/g, '');
  // Limit to 200 chars
  const truncated = cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
  return truncated || 'unnamed';
}

const MAGIC_BYTE_SIGNATURES: Record<string, string[]> = {
  'image/png':    ['\x89PNG'],
  'image/jpeg':   ['\xFF\xD8\xFF'],
  'image/gif':    ['GIF87a', 'GIF89a'],
  'application/pdf': ['%PDF'],
  'application/zip': ['PK\x03\x04'],
  'application/gzip': ['\x1F\x8B'],
};

/** Validate file content by checking magic bytes */
export function validateContentType(buffer: Buffer): boolean {
  if (buffer.length < 4) return true; // too small to inspect, allow
  const magic = buffer.slice(0, 8).toString('latin1');
  for (const [_, signatures] of Object.entries(MAGIC_BYTE_SIGNATURES)) {
    for (const sig of signatures) {
      if (magic.includes(sig)) {
        return true;
      }
    }
  }
  try {
    const text = buffer.toString('utf8');
    const hasNullByte = text.slice(0, 512).includes('\0');
    if (!hasNullByte && text.length > 0 && text.length <= buffer.length * 1.5) {
      return true; // text/JSON/XML
    }
  } catch {
    // UTF-8 parse failed
  }
  return false;
}

export async function pinFileToStorage(fileBuffer: Buffer, filename: string): Promise<PinResult> {
  const safeFilename = sanitizeFilename(filename);
  const pinataJwt = process.env.PINATA_JWT;
  
  if (pinataJwt && pinataJwt.trim().length > 0) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, { filename: safeFilename });

      const metadata = JSON.stringify({
        name: safeFilename,
        keyvalues: {
          project: 'ipfs-pay-to-pin',
          app: 'x402-gateway',
        },
      });
      formData.append('pinataMetadata', metadata);

      const options = JSON.stringify({
        cidVersion: 1,
      });
      formData.append('pinataOptions', options);

      const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
        maxBodyLength: Infinity,
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
          ...formData.getHeaders(),
        },
        timeout: 30000, // 30s timeout
      });

      const ipfsCid = response.data.IpfsHash;
      return {
        ipfs_cid: ipfsCid,
        gateway_url: `https://ipfs.io/ipfs/${ipfsCid}`,
      };
    } catch (e: any) {
      console.warn("Pinata API failed, falling back to local hash pinning:", e?.message);
    }
  }

  // Local fallback storage
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const mockCid = `bafybeig${hash.substring(0, 52)}`;

  const storageDir = process.env.LOCAL_STORAGE_DIR || 'tmp/mock_storage';
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const filePath = path.join(storageDir, `${mockCid}_${safeFilename}`);
  fs.writeFileSync(filePath, fileBuffer);

  return {
    ipfs_cid: mockCid,
    gateway_url: `https://ipfs.io/ipfs/${mockCid}`,
  };
}

export async function unpinFileFromIPFS(cid: string): Promise<void> {
  const pinataJwt = process.env.PINATA_JWT;
  
  if (pinataJwt && pinataJwt.trim().length > 0) {
    try {
      await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
        },
      });
      console.log(`[Storage] Successfully unpinned CID ${cid} from Pinata`);
    } catch (e: any) {
      console.warn(`[Storage] Failed to unpin CID ${cid} from Pinata:`, e?.message);
    }
  }

  // Local fallback storage cleanup
  const storageDir = process.env.LOCAL_STORAGE_DIR || 'tmp/mock_storage';
  if (fs.existsSync(storageDir)) {
    const files = fs.readdirSync(storageDir);
    for (const file of files) {
      if (file.startsWith(`${cid}_`)) {
        try {
          fs.unlinkSync(path.join(storageDir, file));
          console.log(`[Storage] Successfully deleted local fallback for CID ${cid}`);
        } catch (e: any) {
          console.warn(`[Storage] Failed to delete local fallback for CID ${cid}:`, e?.message);
        }
      }
    }
  }
}
