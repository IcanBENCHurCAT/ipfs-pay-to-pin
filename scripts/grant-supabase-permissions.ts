/*
 * Grant table privileges & RLS policies on Supabase pin_records.
 *
 * WARNING: This script must NEVER be committed with real credentials.
 *   Set SUPABASE_DATABASE_URL in .env before running.
 *
 * Usage:
 *   export SUPABASE_DATABASE_URL="postgresql://postgres:<project>:***@<host>.supabase.com:5432/postgres"
 *   npx ts-node scripts/grant-supabase-permissions.ts
 */

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pgUrl = process.env.SUPABASE_DATABASE_URL;
if (!pgUrl) {
  console.error('❌ Set SUPABASE_DATABASE_URL in .env before running this script.');
  process.exit(1);
}

const grantSql = `
GRANT ALL ON TABLE public.pin_records TO postgres, anon, service_role, authenticated;
ALTER TABLE public.pin_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to pin_records for service_role and anon"
ON public.pin_records
FOR ALL
TO anon, service_role, authenticated
USING (true)
WITH CHECK (true);
`;

async function main() {
  console.log('Granting table privileges & Row Level Security policies on Supabase...');
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query(grantSql);
    console.log('✅ Successfully granted ALL permissions and RLS policies on public.pin_records!');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('Policy already exists. Granting direct table privileges...');
      await client.query('GRANT ALL ON TABLE public.pin_records TO postgres, anon, service_role, authenticated;');
      console.log('✅ Direct privileges granted!');
    } else {
      console.error('Grant Error:', err.message);
    }
  }

  await client.end();
}

main().catch(console.error);
