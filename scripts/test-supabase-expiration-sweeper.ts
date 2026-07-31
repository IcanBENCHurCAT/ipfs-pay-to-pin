import { createClient } from '@supabase/supabase-js';
import { globalFileQueue } from '../src/queue.ts';
import dotenv from 'dotenv';

dotenv.config();

// Supabase details
const supabaseUrl = process.env.SUPABASE_URL || "https://gtcguonqciokigxlvfyq.supabase.co";
// Service role key or database connection
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function main() {
  console.log("======================================================================");
  console.log("  Testing 365-Day Retention & 30-Day Grace Period Sweeper in DB ");
  console.log("======================================================================");

  console.log(`Supabase URL: ${supabaseUrl}`);

  // Test CID from queue/registry.json or inject new
  const testCid = "bafybeigtestexpiredcid999999999999999999999999999999999";
  const past400Days = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`\n[Step 1] Creating test record with simulated expiration date: ${past400Days} (400 days in the past)`);

  const mockItem = {
    id: `job_test_${Date.now()}`,
    filename: "expired_test_file.png",
    data: "YmFzZTY0",
    cid: testCid,
    ipfsCid: testCid,
    gatewayUrl: `https://ipfs.io/ipfs/${testCid}`,
    status: 'PINNED' as const,
    retryCount: 0,
    createdAt: Date.now() - 400 * 24 * 60 * 60 * 1000,
    sizeBytes: 500,
    pinned_at: Date.now() - 765 * 24 * 60 * 60 * 1000,
    expires_at: Date.now() - 400 * 24 * 60 * 60 * 1000,
    ttl_days: 365,
    renewalsCount: 0
  };

  // Add mock item to queue
  const items = await globalFileQueue.getItems();
  const filtered = items.filter(i => i.cid !== testCid);
  filtered.push(mockItem);
  await (globalFileQueue as any).saveItems(filtered);

  console.log("✅ Successfully injected 400-day expired record into queue database.");

  // Check pin status before sweeper
  console.log("\n[Step 2] Pin Status before Sweeper Run:");
  const statusBefore = await globalFileQueue.getPinStatus(testCid);
  console.log(statusBefore);

  // Execute Sweeper!
  console.log("\n[Step 3] Executing processExpiredPins() Background Worker Sweeper...");
  await globalFileQueue.processExpiredPins();

  // Check record status after sweeper
  console.log("\n[Step 4] Record Status after Sweeper Run:");
  const itemsAfter = await globalFileQueue.getItems();
  const itemAfter = itemsAfter.find(i => i.cid === testCid);

  console.log(`- CID: ${testCid}`);
  console.log(`- Final Status: ${itemAfter?.status}`);

  if (itemAfter?.status === 'FAILED') {
    console.log("\n🎉 SUCCESS! The 365-day + 30-day grace period background worker identified the expired record, invoked unpinFileFromIPFS(), and marked the record as FAILED!");
  } else {
    console.warn("⚠️ Record status did not update to FAILED.");
  }

  // Cleanup mock test item
  const cleaned = itemsAfter.filter(i => i.cid !== testCid);
  await (globalFileQueue as any).saveItems(cleaned);
  console.log("Cleaned up test record.");
}

main().catch(err => console.error("❌ Test Failed:", err));
