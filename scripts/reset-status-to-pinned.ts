/*
 * Reset a pin record status to PINNED.
 *
 * WARNING: This script must NEVER be committed with real credentials.
 *   Set SUPABASE_DATABASE_URL in .env before running.
 *
 * Usage:
 *   export SUPABASE_DATABASE_URL="postgresql://postgres:<project>:***@<host>.supabase.com:5432/postgres"
 *   npx ts-node scripts/reset-status-to-pinned.ts
 */

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pgUrl = process.env.SUPABASE_DATABASE_URL;
if (!pgUrl) {
  console.error('❌ Set SUPABASE_DATABASE_URL in .env before running this script.');
  process.exit(1);
}

async function main() {
  console.log("Resetting status of bafkreibwfq5glw5avxrpxidp77zlmqmeal5a57vsbi3pqnmeuzu33r4epi to 'PINNED'...");
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cid = 'bafkreibwfq5glw5avxrpxidp77zlmqmeal5a57vsbi3pqnmeuzu33r4epi';
  await client.query("UPDATE public.pin_records SET status = 'PINNED', expires_at = '2025-01-01 00:00:00+00' WHERE cid = $1;", [cid]);

  console.log('✅ Successfully reset status to PINNED for CID:', cid);
  await client.end();
}

main().catch(console.error);
