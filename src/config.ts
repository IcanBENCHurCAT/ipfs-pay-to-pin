import dotenv from 'dotenv';

dotenv.config();

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '',
  allowLocalFallback: process.env.ALLOW_LOCAL_FALLBACK === 'true',
  enableAutomaticRefunds: process.env.ENABLE_AUTOMATIC_REFUNDS === 'true',
  algorandMnemonic: process.env.ALGORAND_WALLET_MNEMONIC || '',
  algorandServer: process.env.ALGORAND_SERVER || 'https://mainnet-api.algonode.cloud',
};
