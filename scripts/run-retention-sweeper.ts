import { globalFileQueue } from '../src/queue.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("======================================================================");
  console.log("  Executing Standalone Retention Sweeper against Production Database ");
  console.log("======================================================================");

  console.log("[Worker] Scanning Supabase pin_records for expired pins (> 395 days)...");
  await globalFileQueue.processExpiredPins();
  console.log("✅ Retention sweep complete!");
}

main().catch(console.error);
