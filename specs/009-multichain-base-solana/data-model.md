# Data Model: Multi-Chain Base & Solana Payment Expansion

**Feature Directory**: `specs/009-multichain-base-solana`  
**Created**: 2026-08-10  

---

## Data Entities

### 1. Extended `QueueItem` (Local Buffer Queue)

```typescript
export interface QueueItem {
  id: string;
  filename: string;
  cid: string;
  filePath: string;
  status: 'PENDING' | 'PINNED' | 'FAILED';
  retryCount: number;
  createdAt: number;
  gatewayUrl: string;
  sizeBytes: number;
  pinned_at: number;
  expires_at: number;
  ttl_days: number;
  renewalsCount: number;

  // Multi-Chain Payment Fields
  paymentNetwork: string;  // e.g. "eip155:8453", "solana:5eykt4...", "algorand:mainnet", "eip155:1"
  txHash: string;          // On-chain transaction hash or signature proof
  tokenAddress: string;    // USDC contract / ASA ID / Mint address
  payerAddress: string;    // Client wallet address
  amountPaid: number;      // Payment in microUSDC / atomic units (6 decimals)
  settlementStatus: 'PENDING' | 'VERIFIED' | 'SETTLED' | 'FAILED';
}
```

### 2. Supabase PostgreSQL `pin_records` Schema

```sql
ALTER TABLE pin_records
  ADD COLUMN IF NOT EXISTS payment_network VARCHAR(64) NOT NULL DEFAULT 'algorand:mainnet',
  ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS token_address VARCHAR(128),
  ADD COLUMN IF NOT EXISTS payer_address VARCHAR(128),
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(20, 0),
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(32) DEFAULT 'SETTLED';

-- Unique composite index for cross-chain replay protection
CREATE UNIQUE INDEX IF NOT EXISTS idx_pin_records_chain_tx 
  ON pin_records(payment_network, tx_hash) 
  WHERE tx_hash IS NOT NULL;
```

---

## Validation & State Transitions

1. **Replay Validation**: Before accepting any payment, the system checks `(payment_network, tx_hash)` against Supabase and `registry.json`. If present, reject immediately with HTTP 409 Conflict.
2. **Settlement State Lifecycle**: `PENDING` -> `VERIFIED` -> `SETTLED`.
