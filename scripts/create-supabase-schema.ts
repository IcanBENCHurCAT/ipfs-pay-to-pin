import { Client } from 'pg';

const pgUrl = "postgresql://postgres.gtcguonqciokigxlvfyq:!D-HhcUi4*JU9Ms@aws-1-us-west-2.pooler.supabase.com:5432/postgres";

const schemaSql = `
CREATE TABLE IF NOT EXISTS public.pin_records (
    cid TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    size_bytes BIGINT DEFAULT 0,
    pinned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    renewals_count INT DEFAULT 0,
    status TEXT DEFAULT 'PINNED'
);

CREATE INDEX IF NOT EXISTS idx_pin_records_status ON public.pin_records(status);
CREATE INDEX IF NOT EXISTS idx_pin_records_expires_at ON public.pin_records(expires_at);
`;

async function main() {
  console.log("Creating 'pin_records' table in Supabase PostgreSQL database...");
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  await client.query(schemaSql);
  console.log("✅ Successfully created 'pin_records' table and indexes in Supabase!");

  await client.end();
}

main().catch(console.error);
