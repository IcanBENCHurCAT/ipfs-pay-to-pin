import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pgUrl = process.env.SUPABASE_DATABASE_URL;

async function main() {
  if (!pgUrl) {
    console.error("❌ Error: No SUPABASE_DATABASE_URL found in .env");
    process.exit(1);
  }
  console.log("Resetting status of bafkreibwfq5glw5avxrpxidp77zlmqmeal5a57vsbi3pqnmeuzu33r4epi to 'PINNED'...");
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cid = "bafkreibwfq5glw5avxrpxidp77zlmqmeal5a57vsbi3pqnmeuzu33r4epi";
  await client.query("UPDATE public.pin_records SET status = 'PINNED', expires_at = '2025-01-01 00:00:00+00' WHERE cid = $1;", [cid]);

  console.log("✅ Successfully reset status to PINNED for CID:", cid);
  await client.end();
}

main().catch(console.error);
