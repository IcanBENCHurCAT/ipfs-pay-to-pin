import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from('pin_records').select('*');
  console.log('Supabase select result:');
  console.log('Error:', error);
  console.log('Data:', data);
}

main().catch(console.error);
