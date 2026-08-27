import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { config } from './config.js';
import { QueueItem } from './queue.js';
import fs from 'fs';

export class DbManager {
  private supabase: SupabaseClient | null = null;
  private registryPath: string;

  public static readonly MIGRATION_SQL = `
ALTER TABLE public.pin_records
  ADD COLUMN IF NOT EXISTS payment_network VARCHAR(64) NOT NULL DEFAULT 'algorand:mainnet',
  ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS token_address VARCHAR(128),
  ADD COLUMN IF NOT EXISTS payer_address VARCHAR(128),
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(20, 0),
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(32) DEFAULT 'SETTLED';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pin_records_chain_tx 
  ON public.pin_records(payment_network, tx_hash) 
  WHERE tx_hash IS NOT NULL;
`;

  constructor(registryPath: string) {
    this.registryPath = registryPath;
  }

  private getSupabaseClient(): SupabaseClient | null {
    if (!this.supabase && config.supabaseUrl && config.supabaseKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: false }
      });
    }
    return this.supabase;
  }

  async saveItems(items: QueueItem[]) {
    // Atomic file write: Write to a temporary file then rename atomically over registryPath to prevent corruption during race conditions
    const tempPath = `${this.registryPath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    // ⚡ Bolt: Removed JSON pretty printing overhead to prevent massive string allocations
    const jsonString = JSON.stringify(items);
    await fs.promises.writeFile(tempPath, jsonString);
    await fs.promises.rename(tempPath, this.registryPath);

    const client = this.getSupabaseClient();
    if (client) {
      // ⚡ Bolt: Single pass O(N) deduplication and valid check directly into Map, avoiding chained map/filter/reduce allocations
      // Cached fallback timestamp to avoid allocating new Date objects inside the loop
      const fallbackNowStr = new Date().toISOString();
      const uniqueByCidMap = new Map();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.cid) {
          uniqueByCidMap.set(item.cid, {
            cid: item.cid,
            filename: item.filename,
            size_bytes: item.sizeBytes || 0,
            pinned_at: item.pinned_at ? new Date(item.pinned_at).toISOString() : fallbackNowStr,
            expires_at: item.expires_at ? new Date(item.expires_at).toISOString() : fallbackNowStr,
            renewals_count: item.renewalsCount || 0,
            status: item.status,
            payment_network: item.paymentNetwork || 'algorand:mainnet',
            tx_hash: item.txHash || null,
            token_address: item.tokenAddress || null,
            payer_address: item.payerAddress || null,
            amount_paid: item.amountPaid !== undefined && item.amountPaid !== null ? item.amountPaid : null,
            settlement_status: item.settlementStatus || 'SETTLED'
          });
        }
      }

      const uniqueByCid = Array.from(uniqueByCidMap.values());
      if (uniqueByCid.length > 0) {
        const { error } = await client.from('pin_records').upsert(uniqueByCid, { onConflict: 'cid' });
        if (error) {
          console.error(`[DbManager] Failed to batch sync ${uniqueByCid.length} items to Supabase:`, error);
        }
      }
    }
  }

  async getItems(): Promise<QueueItem[]> {
    const client = this.getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from('pin_records').select('*');
        if (!error && data && Array.isArray(data)) {
          const fallbackNowNum = Date.now();
          const items: QueueItem[] = data.map(r => {
            const pinnedAtNum = r.pinned_at ? Date.parse(r.pinned_at) : fallbackNowNum;
            const expiresAtNum = r.expires_at ? Date.parse(r.expires_at) : fallbackNowNum;
            return {
              id: `job_${pinnedAtNum}_${r.cid.slice(-5)}`,
              filename: r.filename,
              cid: r.cid,
              filePath: `queue/recovered_${r.cid}.bin`,
              status: r.status as any,
              retryCount: 0,
              createdAt: pinnedAtNum,
              gatewayUrl: `https://ipfs.io/ipfs/${r.cid}`,
              sizeBytes: Number(r.size_bytes || 0),
              pinned_at: pinnedAtNum,
              expires_at: expiresAtNum,
              ttl_days: 365,
              renewalsCount: Number(r.renewals_count || 0),
              paymentNetwork: r.payment_network || 'algorand:mainnet',
              txHash: r.tx_hash || undefined,
              tokenAddress: r.token_address || undefined,
              payerAddress: r.payer_address || undefined,
              amountPaid: r.amount_paid !== null && r.amount_paid !== undefined ? Number(r.amount_paid) : undefined,
              settlementStatus: (r.settlement_status as any) || 'SETTLED'
            };
          });

          // ⚡ Bolt: Removed redundant fs.promises.writeFile and JSON.stringify here.
          // Persisting to the local registry on every database read creates massive
          // JSON string allocations and blocks disk I/O on hot paths. saveItems()
          // already properly maintains the local fallback state.
          return items;
        }
      } catch (err) {
        console.warn('[DbManager] Supabase fetch failed, falling back to local registry:', err);
      }
    }

    try {
      // ⚡ Bolt: Replace synchronous file read with async to avoid blocking event loop
      const data = await fs.promises.readFile(this.registryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async findByTxHash(paymentNetwork: string, txHash: string): Promise<QueueItem | undefined> {
    if (!txHash) return undefined;
    const client = this.getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('pin_records')
          .select('*')
          .eq('payment_network', paymentNetwork)
          .eq('tx_hash', txHash)
          .maybeSingle();

        if (!error && data) {
          const fallbackNowNum = Date.now();
          const pinnedAtNum = data.pinned_at ? Date.parse(data.pinned_at) : fallbackNowNum;
          const expiresAtNum = data.expires_at ? Date.parse(data.expires_at) : fallbackNowNum;
          return {
            id: `job_${pinnedAtNum}_${data.cid.slice(-5)}`,
            filename: data.filename,
            cid: data.cid,
            filePath: `queue/recovered_${data.cid}.bin`,
            status: data.status as any,
            retryCount: 0,
            createdAt: pinnedAtNum,
            gatewayUrl: `https://ipfs.io/ipfs/${data.cid}`,
            sizeBytes: Number(data.size_bytes || 0),
            pinned_at: pinnedAtNum,
            expires_at: expiresAtNum,
            ttl_days: 365,
            renewalsCount: Number(data.renewals_count || 0),
            paymentNetwork: data.payment_network || 'algorand:mainnet',
            txHash: data.tx_hash || undefined,
            tokenAddress: data.token_address || undefined,
            payerAddress: data.payer_address || undefined,
            amountPaid: data.amount_paid !== null && data.amount_paid !== undefined ? Number(data.amount_paid) : undefined,
            settlementStatus: (data.settlement_status as any) || 'SETTLED'
          };
        }
      } catch (err) {
        console.warn('[DbManager] Supabase txHash lookup failed, checking local cache:', err);
      }
    }

    const items = await this.getItems();
    return items.find(item => item.paymentNetwork === paymentNetwork && item.txHash === txHash);
  }
}
