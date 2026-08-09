import { Client } from 'pg';

const pgUrl = "postgresql://postgres.gtcguonqciokigxlvfyq:REDACTED_PASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres";

async function main() {
  console.log("Resetting status of bafkreibwfq5glw5avxrpxidp77zlmqmeal5a57vsbi3pqnmeuzu33r4epi to 'PINNED'...");
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cid = "bafkreibwfq5glw5avxrpxidp77zlmqmeal5a57vsbi3pqnmeuzu33r4epi";
  await client.query("UPDATE public.pin_records SET status = 'PINNED', expires_at = '2025-01-01 00:00:00+00' WHERE cid = $1;", [cid]);

  console.log("✅ Successfully reset status to PINNED for CID:", cid);
  await client.end();
}

main().catch(console.error);
