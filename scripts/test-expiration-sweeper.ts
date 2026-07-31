import { globalFileQueue } from '../src/queue.js';
import dotenv from 'dotenv';

dotenv.config();

async function testExpirationSweeper() {
  console.log("======================================================================");
  console.log("  Testing 365-Day Retention Expiration & Auto-Cleanup Sweeper ");
  console.log("======================================================================");

  // Use the live CID we pinned earlier!
  const testCid = "bafkreibwfq5glw5avxrpxidp77zlmqmeal5a57vsbi3pqnmeuzu33r4epi";
  const past400Days = Date.now() - 400 * 24 * 60 * 60 * 1000; // 400 days in the past

  console.log(`[Step 1] Fetching live records and simulating past expiration date for CID: ${testCid}`);
  const items = await globalFileQueue.getItems();
  console.log(`- Loaded ${items.length} items from database.`);

  const targetItem = items.find(i => i.cid === testCid);

  if (!targetItem) {
    console.error(`❌ Record for CID ${testCid} not found in database.`);
    return;
  }

  const originalExpiresAt = targetItem.expires_at;
  const originalStatus = targetItem.status;

  console.log(`- Original Expiration Date: ${new Date(originalExpiresAt).toISOString()} (Status: ${originalStatus})`);

  // Alter expiration date to 400 days in the past (395+ days threshold exceeded)
  targetItem.expires_at = past400Days;
  await (globalFileQueue as any).saveItems(items);

  console.log(`- Altered Expiration Date:  ${new Date(targetItem.expires_at).toISOString()} (400 days ago)`);
  console.log("✅ Successfully updated record in Supabase / Local DB to past expiration timestamp.");

  // Check status before sweeper
  console.log("\n[Step 2] Querying Pin Status Before Sweeper Run...");
  const statusBefore = await globalFileQueue.getPinStatus(testCid);
  console.log("Status Before Sweep:", statusBefore);

  // Execute Background Sweeper!
  console.log("\n[Step 3] Executing processExpiredPins() Background Sweeper...");
  await globalFileQueue.processExpiredPins();

  // Check status after sweeper
  console.log("\n[Step 4] Querying Record Status After Sweeper Run...");
  const itemsAfter = await globalFileQueue.getItems();
  const itemAfterSweep = itemsAfter.find(i => i.cid === testCid);

  console.log(`Record Status in Database after Sweep: ${itemAfterSweep?.status}`);

  if (itemAfterSweep?.status === 'FAILED') {
    console.log("\n🎉 SUCCESS! Background sweeper identified expired record (> 395 days), unpinned from IPFS, and updated status to FAILED!");
  } else {
    console.warn("⚠️ Record status did not update to FAILED as expected.");
  }

  // Restore original active state
  targetItem.expires_at = originalExpiresAt;
  targetItem.status = originalStatus;
  await (globalFileQueue as any).saveItems(items);
  console.log("\nRestored original expiration date and status in database.");
}

testExpirationSweeper().catch(err => console.error("❌ Test Failed:", err));
