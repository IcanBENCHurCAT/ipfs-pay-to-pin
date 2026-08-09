import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gtcguonqciokigxlvfyq.supabase.co";
const supabaseKey = "REDACTED_SUPABASE_SERVICE_ROLE_KEY";

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from('pin_records').select('*');
  console.log("Supabase select result:");
  console.log("Error:", error);
  console.log("Data:", data);
}

main().catch(console.error);
