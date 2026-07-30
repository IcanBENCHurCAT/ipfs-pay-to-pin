import fs from 'fs';
import path from 'path';
import { calculateLocalCid } from './cid.js';
import { pinFileToStorage, unpinFileFromIPFS } from './storage.js';

import { DbManager } from './db.js';

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
}

export class FileQueue {
  private queueDir: string;
  private registryPath: string;
  private maxRetries: number = 100;
  private maxQueueSize: number = 50;
  private dbManager: DbManager;
  private itemsCache: QueueItem[] = [];

  constructor(queueDir = 'queue') {
    this.queueDir = path.resolve(queueDir);
    this.registryPath = path.join(this.queueDir, 'registry.json');
    this.ensureDirs();
    this.dbManager = new DbManager(this.registryPath);
    this.itemsCache = this.getItemsSync();
  }

  private ensureDirs() {
    if (!fs.existsSync(this.queueDir)) {
      fs.mkdirSync(this.queueDir, { recursive: true });
    }
    if (!fs.existsSync(this.registryPath)) {
      fs.writeFileSync(this.registryPath, JSON.stringify([], null, 2));
    }
  }

  private getItemsSync(): QueueItem[] {
    try {
      const data = fs.readFileSync(this.registryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async getItems(): Promise<QueueItem[]> {
    this.itemsCache = await this.dbManager.getItems();
    return this.itemsCache;
  }

  private async saveItems(items: QueueItem[]) {
    this.itemsCache = items;
    await this.dbManager.saveItems(items);
  }

  public getQueueSize(): number {
    return this.itemsCache.filter(item => item.status === 'PENDING').length;
  }

  public getMaxQueueSize(): number {
    return this.maxQueueSize;
  }

  public async findByCid(cid: string): Promise<QueueItem | undefined> {
    const items = await this.getItems();
    return items.find(item => item.cid === cid && item.status === 'PINNED');
  }

  public async addJob(filename: string, buffer: Buffer): Promise<QueueItem> {
    const cid = calculateLocalCid(buffer);

    // Deduplication check
    const existing = await this.findByCid(cid);
    if (existing) {
      console.log(`[Queue] Deduplication match for CID ${cid}. File already pinned.`);
      return existing;
    }

    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const filePath = path.join(this.queueDir, `${id}_${filename}`);
    
    fs.writeFileSync(filePath, buffer);

    const now = Date.now();
    const item: QueueItem = {
      id,
      filename,
      cid,
      filePath,
      status: 'PENDING',
      retryCount: 0,
      createdAt: now,
      gatewayUrl: `https://ipfs.io/ipfs/${cid}`,
      sizeBytes: buffer.length,
      pinned_at: now,
      expires_at: now + 365 * 24 * 60 * 60 * 1000,
      ttl_days: 365,
      renewalsCount: 0
    };

    const items = await this.getItems();
    items.push(item);
    await this.saveItems(items);

    console.log(`[Queue] Added new job ${id} for file ${filename} (CID: ${cid}).`);
    return item;
  }

  public async processJobs(): Promise<void> {
    const items = await this.getItems();
    const pendingItems = items.filter(item => item.status === 'PENDING');

    if (pendingItems.length === 0) return;

    console.log(`[Queue Worker] Processing ${pendingItems.length} pending pinning jobs...`);

    for (const item of pendingItems) {
      try {
        if (!fs.existsSync(item.filePath)) {
          item.status = 'FAILED';
          continue;
        }

        const buffer = fs.readFileSync(item.filePath);
        const result = await pinFileToStorage(buffer, item.filename);

        item.status = 'PINNED';
        item.cid = result.ipfs_cid;
        item.gatewayUrl = result.gateway_url;

        // Clean up disk buffer after successful pin
        try {
          fs.unlinkSync(item.filePath);
        } catch {}

        console.log(`[Queue Worker] Successfully pinned job ${item.id} -> CID ${result.ipfs_cid}`);
      } catch (err: any) {
        item.retryCount += 1;
        console.warn(`[Queue Worker] Failed job ${item.id} (Attempt ${item.retryCount}/${this.maxRetries}): ${err?.message}`);
        
        if (item.retryCount >= this.maxRetries) {
          console.error(`[Queue Worker] Job ${item.id} exceeded max retries. Marking as FAILED.`);
          item.status = 'FAILED';
        }
      }
    }

    await this.saveItems(items);
  }

  public async renewPin(cid: string): Promise<QueueItem | undefined> {
    const items = await this.getItems();
    const itemIndex = items.findIndex(i => i.cid === cid && (i.status === 'PINNED' || i.status === 'PENDING'));
    
    if (itemIndex === -1) {
      return undefined;
    }
    
    const item = items[itemIndex];
    // Extend from current expires_at if it's in the future, or from NOW if it has already expired
    const now = Date.now();
    const baseTime = item.expires_at > now ? item.expires_at : now;
    
    item.expires_at = baseTime + 365 * 24 * 60 * 60 * 1000;
    item.renewalsCount += 1;
    
    await this.saveItems(items);
    console.log(`[Queue] Renewed CID ${cid}. New expires_at: ${new Date(item.expires_at).toISOString()}`);
    return item;
  }

  public async getPinStatus(cid: string) {
    const item = await this.findByCid(cid);
    if (!item) {
      return undefined;
    }

    const now = Date.now();
    const is_active = now <= item.expires_at;
    let days_remaining = 0;
    if (is_active) {
      days_remaining = Math.ceil((item.expires_at - now) / (1000 * 60 * 60 * 24));
    }

    return {
      pinned_at: new Date(item.pinned_at).toISOString(),
      expires_at: new Date(item.expires_at).toISOString(),
      days_remaining,
      is_active,
      ttl_days: item.ttl_days,
      renewals_count: item.renewalsCount,
      renewal_url: '/api/v1/renew'
    };
  }

  public async processExpiredPins(): Promise<void> {
    const items = await this.getItems();
    const now = Date.now();
    let changed = false;

    for (const item of items) {
      if (item.status === 'PINNED') {
        const gracePeriodEnd = item.expires_at + 30 * 24 * 60 * 60 * 1000;
        if (now > gracePeriodEnd) {
          console.log(`[Queue Worker] CID ${item.cid} has exceeded grace period. Unpinning...`);
          await unpinFileFromIPFS(item.cid);
          item.status = 'FAILED'; // Or 'UNPINNED', but let's stick to existing statuses or add it.
          changed = true;
        }
      }
    }

    if (changed) {
      await this.saveItems(items);
    }
  }
}

export const globalFileQueue = new FileQueue();
