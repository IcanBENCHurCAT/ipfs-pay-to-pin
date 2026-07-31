import { Client } from 'pg';

const pgUrl = "postgresql://postgres.gtcguonqciokigxlvfyq:REDACTED_PASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres";

async function main() {
  console.log("======================================================================");
  console.log("  Syncing REAL Pinata CIDs to Supabase & Triggering Real Unpin ");
  console.log("======================================================================");

  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Real Pinata CIDs from live testing
  const cid1 = "bafkreibwfq5glw5avxrpxidp77zlmqmeal5a57vsbi3pqnmeuzu33r4epi"; // ipfs_pay_to_pin_verified.svg
  const cid2 = "bafkreiewws62ozsuqdylwhlj2ylu7hxauxygofmiuiezncvmjg2gofg2hq"; // grey_box_live_official.png

  const past400Days = "2025-01-01 00:00:00+00";

  console.log(`[Action 1] Inserting real Pinata CID into Supabase with EXPIRED timestamp (400 days ago):`);
  console.log(`- CID: ${cid1} (ipfs_pay_to_pin_verified.svg)`);
  console.log(`- Simulated Expiration: ${past400Days}`);

  await client.query(`
    INSERT INTO public.pin_records (cid, filename, size_bytes, pinned_at, expires_at, renewals_count, status)
    VALUES ($1, $2, $3, NOW() - INTERVAL '765 days', $4, 0, 'PINNED')
    ON CONFLICT (cid) DO UPDATE SET
      expires_at = EXCLUDED.expires_at,
      status = 'PINNED';
  `, [cid1, "ipfs_pay_to_pin_verified.svg", 650, past400Days]);

  console.log(`\n[Action 2] Inserting real active Pinata CID into Supabase (+365 days in future):`);
  console.log(`- CID: ${cid2} (grey_box_live_official.png)`);

  await client.query(`
    INSERT INTO public.pin_records (cid, filename, size_bytes, pinned_at, expires_at, renewals_count, status)
    VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '365 days', 0, 'PINNED')
    ON CONFLICT (cid) DO UPDATE SET
      status = 'PINNED';
  `, [cid2, "grey_box_live_official.png", 70]);

  console.log("\n✅ Supabase pin_records database updated with real Pinata CIDs!");

  const res = await client.query("SELECT cid, filename, status, expires_at FROM public.pin_records;");
  console.table(res.rows);

  console.log("\n======================================================================");
  console.log("  WATCH YOUR PINATA DASHBOARD & HEROKU LOGS NOW! ");
  console.log("======================================================================");
  console.log(`Heroku worker will sweep within 10 seconds.`);
  console.log(`It will issue a DELETE request to Pinata for CID: ${cid1}`);
  console.log(`Refresh your Pinata dashboard: ${cid1} WILL BE DELETED!`);
  console.log("======================================================================");

  await client.end();
}

main().catch(console.error);
