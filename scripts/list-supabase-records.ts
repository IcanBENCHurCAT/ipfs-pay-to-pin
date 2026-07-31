import { Client } from 'pg';

const pgUrl = "postgresql://postgres.gtcguonqciokigxlvfyq:!D-HhcUi4*JU9Ms@aws-1-us-west-2.pooler.supabase.com:5432/postgres";

async function main() {
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const res = await client.query("SELECT cid, filename, status, expires_at FROM public.pin_records;");
  console.log("Current Supabase pin_records Table:");
  console.table(res.rows);

  await client.end();
}

main().catch(console.error);
