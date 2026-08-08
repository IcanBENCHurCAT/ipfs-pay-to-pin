import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pgUrl = process.env.SUPABASE_DATABASE_URL;

async function main() {
  if (!pgUrl) {
    console.error("❌ Error: No SUPABASE_DATABASE_URL found in .env");
    process.exit(1);
  }

  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const res = await client.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog');
  `);
  
  console.log("Supabase Database Tables:");
  console.table(res.rows);

  await client.end();
}

main().catch(console.error);
