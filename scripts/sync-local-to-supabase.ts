import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pgUrl = process.env.SUPABASE_DATABASE_URL;

async function main() {
  if (!pgUrl) {
    console.error("❌ Error: No SUPABASE_DATABASE_URL found in .env");
    process.exit(1);
  }

  console.log("Syncing local registry.json records to Supabase...");
  const registryPath = path.join(process.cwd(), 'queue', 'registry.json');
  if (!fs.existsSync(registryPath)) {
    console.error("No local registry.json found.");
    return;
  }

  const items = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  console.log(`Found ${items.length} items in local registry.json.`);

  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const item of items) {
    const pinnedAt = item.pinned_at ? new Date(item.pinned_at).toISOString() : new Date().toISOString();
    const expiresAt = item.expires_at ? new Date(item.expires_at).toISOString() : new Date().toISOString();

    await client.query(`
      INSERT INTO public.pin_records (cid, filename, size_bytes, pinned_at, expires_at, renewals_count, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (cid) DO UPDATE SET
        expires_at = EXCLUDED.expires_at,
        renewals_count = EXCLUDED.renewals_count,
        status = EXCLUDED.status;
    `, [
      item.cid,
      item.filename || "file.bin",
      item.sizeBytes || 1000,
      pinnedAt,
      expiresAt,
      item.renewalsCount || 0,
      item.status || "PINNED"
    ]);

    console.log(`Synced CID: ${item.cid} | Expires At: ${expiresAt}`);
  }

  await client.end();
  console.log("✅ Successfully synced local records to Supabase!");
}

main().catch(console.error);
