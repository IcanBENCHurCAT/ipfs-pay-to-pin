import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gtcguonqciokigxlvfyq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0Y2d1b25xY2lva2lneGx2ZnlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk2NzA0MiwiZXhwIjoyMTAwNTQzMDQyfQ.AN1a3mMgC4he1n8CJL29g4Lc9x8gBze35XJE1uvt_D8";

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from('pin_records').select('*');
  console.log("Supabase select result:");
  console.log("Error:", error);
  console.log("Data:", data);
}

main().catch(console.error);
