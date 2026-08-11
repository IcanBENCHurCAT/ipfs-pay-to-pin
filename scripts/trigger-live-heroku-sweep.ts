import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
// Service role key or anon key from env/heroku
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY in .env");
    process.exit(1);
  }
  console.log("======================================================================");
  console.log("  Altering Live Supabase Record to Trigger Heroku Worker Sweeper Log ");
  console.log("======================================================================");

  // We can also use pg connection if needed
  const { Client } = await import('pg');
  const pgUrl = process.env.SUPABASE_DATABASE_URL;
  if (!pgUrl) {
    console.error("❌ Error: No SUPABASE_DATABASE_URL found in .env");
    process.exit(1);
  }
  const pgClient = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });

  await pgClient.connect();
  console.log("✅ Connected directly to Supabase PostgreSQL database.");

  // Fetch current rows
  const res = await pgClient.query("SELECT cid, filename, status, expires_at FROM pin_records ORDER BY pinned_at DESC LIMIT 5;");
  console.log("\nCurrent Live Supabase Pin Records:");
  console.table(res.rows);

  if (res.rows.length === 0) {
    console.error("❌ No pin records found in Supabase pin_records table.");
    await pgClient.end();
    return;
  }

  const targetCid = res.rows[0].cid;
  const targetFilename = res.rows[0].filename;
  const past400Days = "2025-01-01 00:00:00+00";

  console.log(`\n[Action] Altering expires_at for CID ${targetCid} (${targetFilename}) to ${past400Days}...`);

  await pgClient.query("UPDATE pin_records SET expires_at = $1 WHERE cid = $2;", [past400Days, targetCid]);
  console.log("✅ Live Supabase row updated!");

  console.log("\n======================================================================");
  console.log("  WATCH YOUR HEROKU LOGS NOW! ");
  console.log("======================================================================");
  console.log("Run this command in your terminal:\n");
  console.log("  heroku logs --tail -a ipfs-pay-to-pin-mainnet\n");
  console.log("Within 10 seconds, Heroku's background worker will sweep Supabase and print:\n");
  console.log(`  [Queue Worker] CID ${targetCid} has exceeded grace period. Unpinning...`);
  console.log("======================================================================");

  await pgClient.end();
}

main().catch(err => console.error("❌ Error:", err));
