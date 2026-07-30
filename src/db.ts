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

      for (const record of records) {
        if (!record.cid) continue;
        const { error } = await this.supabase.from('pin_records').upsert(record, { onConflict: 'cid' });
        if (error) {
          console.error(`[DbManager] Failed to sync item ${record.cid} to Supabase:`, error);
        }
      }
    }
  }

  async getItems(): Promise<QueueItem[]> {
    try {
      const data = fs.readFileSync(this.registryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}
