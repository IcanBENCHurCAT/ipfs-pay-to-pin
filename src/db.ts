import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { QueueItem } from './queue.js';
import fs from 'fs';

export class DbManager {
  private supabase: SupabaseClient | null = null;
  private registryPath: string;

  constructor(registryPath: string) {
    this.registryPath = registryPath;
    if (config.supabaseUrl && config.supabaseKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    }
  }

  async saveItems(items: QueueItem[]) {
    fs.writeFileSync(this.registryPath, JSON.stringify(items, null, 2));

    if (this.supabase) {
      const records = items.map(item => ({
        cid: item.cid,
        filename: item.filename,
        size_bytes: item.sizeBytes || 0,
        pinned_at: item.pinned_at ? new Date(item.pinned_at).toISOString() : new Date().toISOString(),
        expires_at: item.expires_at ? new Date(item.expires_at).toISOString() : new Date().toISOString(),
        renewals_count: item.renewalsCount || 0,
        status: item.status
      }));

      const validRecords = records.filter(r => Boolean(r.cid));
      if (validRecords.length > 0) {
        const { error } = await this.supabase.from('pin_records').upsert(validRecords, { onConflict: 'cid' });
        if (error) {
          console.error(`[DbManager] Failed to batch sync ${validRecords.length} items to Supabase:`, error);
        }
      }
    }
  }

  async getItems(): Promise<QueueItem[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from('pin_records').select('*');
        if (!error && data && Array.isArray(data)) {
          const items: QueueItem[] = data.map(r => ({
            id: `job_${Date.parse(r.pinned_at || new Date().toISOString())}_${r.cid.slice(-5)}`,
            filename: r.filename,
            cid: r.cid,
            filePath: `queue/recovered_${r.cid}.bin`,
            status: r.status as any,
            retryCount: 0,
            createdAt: Date.parse(r.pinned_at || new Date().toISOString()),
            gatewayUrl: `https://ipfs.io/ipfs/${r.cid}`,
            sizeBytes: Number(r.size_bytes || 0),
            pinned_at: Date.parse(r.pinned_at || new Date().toISOString()),
            expires_at: Date.parse(r.expires_at || new Date().toISOString()),
            ttl_days: 365,
            renewalsCount: Number(r.renewals_count || 0)
          }));

          // Sync loaded Supabase items to local disk fallback
          fs.writeFileSync(this.registryPath, JSON.stringify(items, null, 2));
          return items;
        }
      } catch (err) {
        console.warn('[DbManager] Supabase fetch failed, falling back to local registry:', err);
      }
    }

    try {
      const data = fs.readFileSync(this.registryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}
