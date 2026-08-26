import dotenv from 'dotenv';

dotenv.config();

function parseSupabaseUrlFromDbUrl(dbUrl: string): string {
  if (!dbUrl) return '';
  const match = dbUrl.match(/postgres\.([a-z0-9]+):/i);
  if (match && match[1]) {
    return `https://${match[1]}.supabase.co`;
  }
  return '';
}

export const config = {
  port: parseInt(process.env.PORT || '4021', 10),
  algorandNetwork: process.env.ALGORAND_NETWORK || 'testnet',
  algorandServer: process.env.ALGORAND_SERVER || process.env.ALGOD_ADDRESS || 'https://mainnet-api.algonode.cloud',
  escrowAddress: process.env.ESCROW_ADDRESS || 'ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY',
  pinataJwt: process.env.PINATA_JWT || '',
  supabaseUrl: process.env.SUPABASE_URL || parseSupabaseUrlFromDbUrl(process.env.SUPABASE_DATABASE_URL || ''),
  supabaseKey: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  allowLocalFallback: process.env.ALLOW_LOCAL_FALLBACK === 'true',
  enableAutomaticRefunds: process.env.ENABLE_AUTOMATIC_REFUNDS === 'true',
  algorandMnemonic: process.env.ALGORAND_WALLET_MNEMONIC || process.env.ALGORAND_MNEMONIC || '',
  trustProxy: process.env.TRUST_PROXY === 'true',
};

export function validateConfig(): void {
  console.log(`[Config] Operating Network: ${config.algorandNetwork}`);
  console.log(`[Config] Escrow Recipient Address: ${config.escrowAddress}`);
  console.log(`[Config] Synchronous Pinning Default Mode: ${!config.allowLocalFallback ? 'ENABLED (Direct Pinata Pinning)' : 'DISABLED (Async Disk Buffer Fallback)'}`);

  if (!config.allowLocalFallback && !config.pinataJwt) {
    console.warn('[Config Warning] PINATA_JWT is not set while ALLOW_LOCAL_FALLBACK=false. File uploads will fail unless PINATA_JWT is configured.');
  }

  if (config.enableAutomaticRefunds && !config.algorandMnemonic) {
    console.warn('[Config Warning] ENABLE_AUTOMATIC_REFUNDS is true but ALGORAND_WALLET_MNEMONIC is missing. Automatic refunds cannot execute on-chain.');
  }
}
