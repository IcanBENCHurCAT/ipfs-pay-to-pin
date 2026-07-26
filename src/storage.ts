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

export async function pinFileToStorage(fileBuffer: Buffer, filename: string): Promise<PinResult> {
  const pinataJwt = process.env.PINATA_JWT;
  
  if (pinataJwt && pinataJwt.trim().length > 0) {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, { filename });

      const metadata = JSON.stringify({
        name: filename,
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
  const mockCid = `Qm${hash.substring(0, 44)}`;

  const storageDir = process.env.LOCAL_STORAGE_DIR || 'tmp/mock_storage';
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const filePath = path.join(storageDir, `${mockCid}_${filename}`);
  fs.writeFileSync(filePath, fileBuffer);

  return {
    ipfs_cid: mockCid,
    gateway_url: `https://ipfs.io/ipfs/${mockCid}`,
  };
}
