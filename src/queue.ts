import fs from 'fs';
import path from 'path';
import { calculateLocalCid } from './cid.js';
import { pinFileToStorage } from './storage.js';

export interface QueueItem {
  id: string;
  filename: string;
  cid: string;
  filePath: string;
  status: 'PENDING' | 'PINNED' | 'FAILED';
  retryCount: number;
  createdAt: number;
  gatewayUrl: string;
}

export class FileQueue {
  private queueDir: string;
  private registryPath: string;
  private maxRetries: number = 100;
  private maxQueueSize: number = 50;

  constructor(queueDir = 'queue') {
    this.queueDir = path.resolve(queueDir);
    this.registryPath = path.join(this.queueDir, 'registry.json');
    this.ensureDirs();
  }

  private ensureDirs() {
    if (!fs.existsSync(this.queueDir)) {
      fs.mkdirSync(this.queueDir, { recursive: true });
    }
    if (!fs.existsSync(this.registryPath)) {
      fs.writeFileSync(this.registryPath, JSON.stringify([], null, 2));
    }
  }

  private getItems(): QueueItem[] {
    try {
      const data = fs.readFileSync(this.registryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private saveItems(items: QueueItem[]) {
    fs.writeFileSync(this.registryPath, JSON.stringify(items, null, 2));
  }

  public getQueueSize(): number {
    return this.getItems().filter(item => item.status === 'PENDING').length;
  }

  public getMaxQueueSize(): number {
    return this.maxQueueSize;
  }

  public findByCid(cid: string): QueueItem | undefined {
    return this.getItems().find(item => item.cid === cid && item.status === 'PINNED');
  }

  public addJob(filename: string, buffer: Buffer): QueueItem {
    const cid = calculateLocalCid(buffer);

    // Deduplication check
    const existing = this.findByCid(cid);
    if (existing) {
      console.log(`[Queue] Deduplication match for CID ${cid}. File already pinned.`);
      return existing;
    }

    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const filePath = path.join(this.queueDir, `${id}_${filename}`);
    
    fs.writeFileSync(filePath, buffer);

    const item: QueueItem = {
      id,
      filename,
      cid,
      filePath,
      status: 'PENDING',
      retryCount: 0,
      createdAt: Date.now(),
      gatewayUrl: `https://ipfs.io/ipfs/${cid}`
    };

    const items = this.getItems();
    items.push(item);
    this.saveItems(items);

    console.log(`[Queue] Added new job ${id} for file ${filename} (CID: ${cid}).`);
    return item;
  }

  public async processJobs(): Promise<void> {
    const items = this.getItems();
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

    this.saveItems(items);
  }
}

export const globalFileQueue = new FileQueue();
