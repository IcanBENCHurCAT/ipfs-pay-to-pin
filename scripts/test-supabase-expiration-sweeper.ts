import { createClient } from '@supabase/supabase-js';
import { globalFileQueue } from '../src/queue.ts';
import dotenv from 'dotenv';

dotenv.config();

// Supabase details — credentials from env only (no fallback to real values)
const supabaseUrl = process.env.SUPABASE_URL;
// Service role key or database connection
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

async function main() {
  console.log('======================================================================');
  console.log('  Testing 365-Day Retention & 30-Day Grace Period Sweeper in DB ');
  console.log('======================================================================');

  console.log(`Supabase URL: ${supabaseUrl}`);

  // Test CID from queue/registry.json or inject new
  const testCid = 'bafybeigtestexpiredcid999999999999999999999999999999999';

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('pin_records')
    .select('*')
    .eq('cid', testCid)
    .limit(1);

  console.log('Query result:');
  console.log('Error:', error);
  console.log('Data:', data);
}

main().catch(console.error);
