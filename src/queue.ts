import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { calculateLocalCid } from './cid.js';
import { pinFileToStorage, unpinFileFromIPFS, sanitizeFilename, validateContentType } from './storage.js';
import { DbManager } from './db.js';

export interface QueueItem {
  id: string;
  filename: string;
  cid: string;
  filePath: string;
  status: 'PENDING' | 'PINNED' | 'FAILED' | 'EXPIRED';
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
  private maxRetries: number = 5;
  private maxQueueSize: number = 50;
  private maxQueueBytes: number = 1000 * 1024 * 1024; // 1GB byte capacity limit
  private maxConcurrent: number = 3;
  private pinataHealthy: boolean = true;
  private consecutiveFailures: number = 0;
  private isProcessing: boolean = false;
  private isProcessingExpired: boolean = false;
  private dbManager: DbManager;
  private itemsCache: QueueItem[] = [];
  private lastCacheTime: number = 0;
  private cacheTtlMs: number = 5000; // ⚡ Bolt: 5s TTL database read cache to sync cleanly with 10s worker loop

  constructor(queueDir = 'queue') {
    this.queueDir = path.resolve(queueDir);
    this.registryPath = path.join(this.queueDir, 'registry.json');
    this.dbManager = new DbManager(this.registryPath);
    this.itemsCache = [];
  }

  public async init(): Promise<void> {
    // ⚡ Bolt: Use asynchronous fs.promises inside init() instead of synchronous fs.existsSync/mkdirSync
    // inside the constructor. This prevents blocking the Node.js event loop on startup.
    try {
      await fs.promises.mkdir(this.queueDir, { recursive: true });
    } catch {}

    try {
      await fs.promises.readFile(this.registryPath);
    } catch {
      await fs.promises.writeFile(this.registryPath, JSON.stringify([], null, 2));
    }
    this.itemsCache = await this.dbManager.getItems();
    console.log(`[Queue] Initialized & recovered ${this.itemsCache.length} records from Supabase/registry.`);
  }

  public async getItems(): Promise<QueueItem[]> {
    // ⚡ Bolt: Cache queue items in memory with TTL to reduce database query overload
    const now = Date.now();
    if (now - this.lastCacheTime > this.cacheTtlMs) {
      this.itemsCache = await this.dbManager.getItems();
      this.lastCacheTime = now;
    }
    return this.itemsCache;
  }

  private async saveItems(items: QueueItem[]) {
    this.itemsCache = items;
    this.lastCacheTime = Date.now(); // ⚡ Bolt: reset cache TTL on save
    await this.dbManager.saveItems(items);
  }

  public getQueueSize(): number {
    // ⚡ Bolt: Use O(N) loops instead of filter().length/reduce to avoid O(N) intermediate array memory allocations and GC pressure
    let count = 0;
    for (let i = 0; i < this.itemsCache.length; i++) {
      if (this.itemsCache[i].status === 'PENDING') count++;
    }
    return count;
  }

  public getQueueBytes(): number {
    // ⚡ Bolt: Use O(N) loops instead of filter().length/reduce to avoid O(N) intermediate array memory allocations and GC pressure
    let sum = 0;
    for (let i = 0; i < this.itemsCache.length; i++) {
      if (this.itemsCache[i].status === 'PENDING') sum += (this.itemsCache[i].sizeBytes || 0);
    }
    return sum;
  }

  public getMaxQueueSize(): number {
    return this.maxQueueSize;
  }

  public getMaxQueueBytes(): number {
    return this.maxQueueBytes;
  }

  public getSize(): number {
    return this.getQueueSize();
  }

  public isHealthy(): boolean {
    return this.pinataHealthy &&
      this.getQueueSize() < this.maxQueueSize &&
      this.getQueueBytes() < this.maxQueueBytes;
  }

  public setPinataHealthy(healthy: boolean): void {
    this.pinataHealthy = healthy;
  }

  public async findByCid(cid: string): Promise<QueueItem | undefined> {
    const items = await this.getItems();
    return items.find(item => item.cid === cid && (item.status === 'PINNED' || item.status === 'PENDING'));
  }

  public async findAnyByCid(cid: string): Promise<QueueItem | undefined> {
    const items = await this.getItems();
    return items.find(item => item.cid === cid);
  }

  public async addJob(filename: string, buffer: Buffer): Promise<QueueItem> {
    const safeFilename = sanitizeFilename(filename);

    if (!validateContentType(buffer)) {
      throw new Error('Unsupported or potentially unsafe file content type.');
    }

    if (this.getQueueBytes() + buffer.length > this.maxQueueBytes) {
      throw new Error('Queue byte capacity exceeded (1GB limit). Please try again later.');
    }

    const cid = calculateLocalCid(buffer);

    const existing = await this.findByCid(cid);
    if (existing && existing.status === 'PINNED') {
      console.log(`[Queue] Deduplication match for CID ${cid}. File already pinned.`);
      return existing;
    }

    const id = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex').substring(0, 5)}`;
    const allowLocalFallback = process.env.ALLOW_LOCAL_FALLBACK === 'true';

    let finalCid = cid;
    let finalGatewayUrl = `https://ipfs.io/ipfs/${cid}`;
    let status: 'PENDING' | 'PINNED' = 'PENDING';
    let filePath = '';

    if (!allowLocalFallback) {
      // Default Mode: Synchronous Pinata Pinning
      // Must successfully pin to Pinata BEFORE returning 201 Created to the client!
      console.log(`[Queue] Synchronously pinning ${safeFilename} to Pinata...`);
      const pinResult = await pinFileToStorage(buffer, safeFilename);
      finalCid = pinResult.ipfs_cid;
      finalGatewayUrl = pinResult.gateway_url;
      status = 'PINNED';
      this.setPinataHealthy(true);
    } else {
      // Feature-flagged Mode: Async local disk buffer queue (ALLOW_LOCAL_FALLBACK=true)
      filePath = path.join(this.queueDir, `${id}_${safeFilename}`);
      await fs.promises.writeFile(filePath, buffer);
    }

    const now = Date.now();
    const item: QueueItem = {
      id,
      filename: safeFilename,
      cid: finalCid,
      filePath,
      status,
      retryCount: 0,
      createdAt: now,
      gatewayUrl: finalGatewayUrl,
      sizeBytes: buffer.length,
      pinned_at: now,
      expires_at: now + 365 * 24 * 60 * 60 * 1000,
      ttl_days: 365,
      renewalsCount: 0
    };

    const items = await this.getItems();
    items.push(item);
    await this.saveItems(items);

    console.log(`[Queue] Saved pin record ${id} for ${safeFilename} (CID: ${finalCid}, Status: ${status}).`);
    return item;
  }

  public async processJobs(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      const items = await this.getItems();
      const pendingItems = items.filter(item => item.status === 'PENDING' && item.retryCount < this.maxRetries);

      if (pendingItems.length === 0) return;

      console.log(`[Queue Worker] Processing ${pendingItems.length} pending pinning jobs (concurrency limit: ${this.maxConcurrent})...`);

      for (let i = 0; i < pendingItems.length; i += this.maxConcurrent) {
        const chunk = pendingItems.slice(i, i + this.maxConcurrent);
        const results = await Promise.allSettled(
          chunk.map(async (item) => {
            let buffer: Buffer;
            try {
              buffer = await fs.promises.readFile(item.filePath);
            } catch {
              item.status = 'FAILED';
              return;
            }

            const result = await pinFileToStorage(buffer, item.filename);

            item.status = 'PINNED';
            item.cid = result.ipfs_cid;
            item.gatewayUrl = result.gateway_url;

            try {
              await fs.promises.unlink(item.filePath);
            } catch {}

            console.log(`[Queue Worker] Successfully pinned job ${item.id} -> CID ${result.ipfs_cid}`);
          })
        );

        let batchFailures = 0;
        results.forEach((res, idx) => {
          if (res.status === 'rejected') {
            batchFailures++;
            const item = chunk[idx];
            item.retryCount += 1;
            const delayMs = Math.min(1000 * Math.pow(2, item.retryCount - 1), 60000);
            console.warn(`[Queue Worker] Failed job ${item.id} (Attempt ${item.retryCount}/${this.maxRetries}, backoff ${delayMs}ms): ${res.reason?.message || res.reason}`);
            
            if (item.retryCount >= this.maxRetries) {
              console.error(`[Queue Worker] Job ${item.id} exceeded max retries. Marking as FAILED.`);
              item.status = 'FAILED';
              fs.promises.unlink(item.filePath).catch(() => {});
            }
          }
        });

        if (batchFailures > 0) {
          this.consecutiveFailures += batchFailures;
          if (this.consecutiveFailures >= 3) {
            this.setPinataHealthy(false);
          }
        } else {
          this.consecutiveFailures = 0;
          this.setPinataHealthy(true);
        }
      }

      await this.saveItems(items);
    } finally {
      this.isProcessing = false;
    }
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
      renewal_url: `/api/v1/renew?cid=${item.cid}`
    };
  }

  public async processExpiredPins(): Promise<void> {
    if (this.isProcessingExpired) {
      return;
    }
    this.isProcessingExpired = true;

    try {
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
              item.status = 'EXPIRED';
              changed = true;
            } catch (e) {
              console.warn(`[Queue Worker] Warning during unpin attempt for ${item.cid}:`, e);
            }
          }
        }
      }

      if (changed) {
        await this.saveItems(items);
      }
    } finally {
      this.isProcessingExpired = false;
    }
  }
}

export const globalFileQueue = new FileQueue();
