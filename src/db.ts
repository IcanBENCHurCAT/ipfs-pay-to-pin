import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { config } from './config.js';
import { QueueItem } from './queue.js';
import fs from 'fs';

// Polyfill global WebSocket for Supabase Realtime in Node environments
(globalThis as any).WebSocket = WebSocket;

export class DbManager {
  private supabase: SupabaseClient | null = null;
  private registryPath: string;

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
    const tempPath = `${this.registryPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    const jsonString = JSON.stringify(items, null, 2);
    await fs.promises.writeFile(tempPath, jsonString);
    await fs.promises.rename(tempPath, this.registryPath);

    const client = this.getSupabaseClient();
    if (client) {
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
        const { error } = await client.from('pin_records').upsert(validRecords, { onConflict: 'cid' });
        if (error) {
          console.error(`[DbManager] Failed to batch sync ${validRecords.length} items to Supabase:`, error);
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
          // ⚡ Bolt: Replace synchronous file write with async to avoid blocking event loop
          await fs.promises.writeFile(this.registryPath, JSON.stringify(items, null, 2));
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
}
