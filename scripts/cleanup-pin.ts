import { unpinFileFromIPFS } from '../src/storage.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Utility script to clean up / unpin test files from Pinata.
 * Usage: npx tsx scripts/cleanup-pin.ts <CID_1> <CID_2> ...
 */
async function main() {
  const cids = process.argv.slice(2);
  if (cids.length === 0) {
    console.log("Usage: npx tsx scripts/cleanup-pin.ts <CID_1> [CID_2 ...]");
    console.log("Example: npx tsx scripts/cleanup-pin.ts bafybeic...");
    return;
  }

  console.log(`[Cleanup] Unpinning ${cids.length} CID(s) from storage...`);

  for (const cid of cids) {
    try {
      console.log(`[Cleanup] Unpinning CID: ${cid}...`);
      await unpinFileFromIPFS(cid);
      console.log(`✅ Successfully unpinned CID: ${cid}`);
    } catch (err: any) {
      console.error(`❌ Failed to unpin CID ${cid}:`, err?.message || err);
    }
  }

  console.log("[Cleanup] Completed.");
}

main();
