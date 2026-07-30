import fs from 'fs';
import path from 'path';
import { calculateLocalCid } from './cid.js';
import { pinFileToStorage, unpinFileFromIPFS, sanitizeFilename, validateContentType } from './storage.js';
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
  private maxRetries: number = 5; // Reduced from 100 to 5 so failing jobs don't stall forever
  private maxQueueSize: number = 50;
  private maxConcurrent: number = 3;
  private pinataHealthy: boolean = true;
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

  public async init(): Promise<void> {
    this.itemsCache = await this.dbManager.getItems();
    console.log(`[Queue] Initialized & recovered ${this.itemsCache.length} records from Supabase/registry.`);
  }

  private getItemsSync(): QueueItem[] {
    try {
      const data = fs.readFileSync(this.registryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public async getItems(): Promise<QueueItem[]> {
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

  public getSize(): number {
    return this.getQueueSize();
  }

  public isHealthy(): boolean {
    return this.pinataHealthy && this.getQueueSize() < this.maxQueueSize;
  }

  public setPinataHealthy(healthy: boolean): void {
    this.pinataHealthy = healthy;
  }

  public async findByCid(cid: string): Promise<QueueItem | undefined> {
    const items = await this.getItems();
    // Check both PINNED and PENDING status for deduplication
    return items.find(item => item.cid === cid && (item.status === 'PINNED' || item.status === 'PENDING'));
  }

  public async addJob(filename: string, buffer: Buffer): Promise<QueueItem> {
    const safeFilename = sanitizeFilename(filename);

    if (!validateContentType(buffer)) {
      throw new Error('Unsupported or potentially unsafe file content type.');
    }

    const cid = calculateLocalCid(buffer);

    // Deduplication check
    const existing = await this.findByCid(cid);
    if (existing) {
      console.log(`[Queue] Deduplication match for CID ${cid}. File already queued/pinned.`);
      return existing;
    }

    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const filePath = path.join(this.queueDir, `${id}_${safeFilename}`);
    
    fs.writeFileSync(filePath, buffer);

    const now = Date.now();
    const item: QueueItem = {
      id,
      filename: safeFilename,
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

    console.log(`[Queue] Added new job ${id} for file ${safeFilename} (CID: ${cid}).`);
    return item;
  }

  public async processJobs(): Promise<void> {
    const items = await this.getItems();
    const pendingItems = items.filter(item => item.status === 'PENDING' && item.retryCount <= this.maxRetries);

    if (pendingItems.length === 0) return;

    console.log(`[Queue Worker] Processing ${pendingItems.length} pending pinning jobs (concurrency limit: ${this.maxConcurrent})...`);

    // Process in concurrent chunks
    for (let i = 0; i < pendingItems.length; i += this.maxConcurrent) {
      const chunk = pendingItems.slice(i, i + this.maxConcurrent);
      await Promise.allSettled(
        chunk.map(async (item) => {
          try {
            if (!fs.existsSync(item.filePath)) {
              item.status = 'FAILED';
              return;
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
            // Exponential backoff with max 60s
            const delayMs = Math.min(1000 * Math.pow(2, item.retryCount - 1), 60000);
            console.warn(`[Queue Worker] Failed job ${item.id} (Attempt ${item.retryCount}/${this.maxRetries}, backoff ${delayMs}ms): ${err?.message}`);
            
            if (item.retryCount >= this.maxRetries) {
              console.error(`[Queue Worker] Job ${item.id} exceeded max retries. Marking as FAILED.`);
              item.status = 'FAILED';
            }
          }
        })
      );
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
          try {
            await unpinFileFromIPFS(item.cid);
          } catch (e) {
            console.warn(`[Queue Worker] Warning during unpin attempt for ${item.cid}:`, e);
          }
          item.status = 'FAILED';
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
