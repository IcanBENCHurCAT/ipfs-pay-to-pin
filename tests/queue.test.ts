import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileQueue } from '../src/queue.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('../src/storage.js', () => ({
  pinFileToStorage: vi.fn().mockResolvedValue({
    ipfs_cid: 'mock-cid-123',
    gateway_url: 'https://ipfs.io/ipfs/mock-cid-123'
  }),
  unpinFileFromIPFS: vi.fn(),
  sanitizeFilename: (name: string) => name,
  validateContentType: () => true,
}));

describe('FileQueue Retention & Renewal Logic', () => {
  let queue: FileQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // We will bypass actual DbManager initialization issues for simple unit testing
    queue = new FileQueue('test-queue');
    
    // Mock saveItems to not actually try to hit a db
    (queue as any).saveItems = vi.fn().mockImplementation(async (items) => {
        (queue as any).itemsCache = items;
    });
    // Mock getItems to avoid hitting db
    (queue as any).getItems = vi.fn().mockImplementation(async () => {
        return (queue as any).itemsCache;
    });
  });

  it('T007: Generates retention metadata on addJob', async () => {
    const buffer = Buffer.from('hello world');
    const job = await queue.addJob('hello.txt', buffer);
    
    const now = Date.now();
    expect(job.pinned_at).toBeLessThanOrEqual(now);
    expect(job.expires_at).toBeGreaterThan(now + 364 * 24 * 60 * 60 * 1000);
    expect(job.expires_at).toBeLessThanOrEqual(now + 366 * 24 * 60 * 60 * 1000);
    expect(job.ttl_days).toBe(365);
    expect(job.renewalsCount).toBe(0);
  });

  it('T011: renewPin extends expires_at by 365 days and increments renewalsCount', async () => {
    const buffer = Buffer.from('hello world');
    const job = await queue.addJob('hello.txt', buffer);
    
    job.status = 'PINNED'; // renewPin requires PINNED or PENDING
    
    const initialExpiresAt = job.expires_at;
    const initialRenewals = job.renewalsCount;

    const renewedJob = await queue.renewPin(job.cid);
    
    expect(renewedJob).toBeDefined();
    expect(renewedJob!.expires_at).toBe(initialExpiresAt + 365 * 24 * 60 * 60 * 1000);
    expect(renewedJob!.renewalsCount).toBe(initialRenewals + 1);
  });

  it('T011: renewPin from expired state extends from NOW', async () => {
    const buffer = Buffer.from('hello world');
    const job = await queue.addJob('hello.txt', buffer);
    job.status = 'PINNED';
    
    const past = Date.now() - 1000;
    job.expires_at = past; // simulate expired
    
    const renewedJob = await queue.renewPin(job.cid);
    
    expect(renewedJob).toBeDefined();
    expect(renewedJob!.expires_at).toBeGreaterThan(Date.now() + 364 * 24 * 60 * 60 * 1000);
    expect(renewedJob!.renewalsCount).toBe(1);
  });

  it('T016: getPinStatus calculates days_remaining and is_active', async () => {
    const buffer = Buffer.from('hello world');
    const job = await queue.addJob('hello.txt', buffer);
    job.status = 'PINNED';
    
    const status = await queue.getPinStatus(job.cid);
    
    expect(status).toBeDefined();
    expect(status!.is_active).toBe(true);
    expect(status!.days_remaining).toBe(365);
    expect(status!.ttl_days).toBe(365);
    expect(status!.renewals_count).toBe(0);
    expect(status!.renewal_url).toBe(`/api/v1/renew?cid=${job.cid}`);
  });

  it('T016: getPinStatus correctly identifies inactive pins', async () => {
    const buffer = Buffer.from('hello world');
    const job = await queue.addJob('hello.txt', buffer);
    job.status = 'PINNED';
    
    const past = Date.now() - 1000;
    job.expires_at = past; // expired
    
    const status = await queue.getPinStatus(job.cid);
    
    expect(status).toBeDefined();
    expect(status!.is_active).toBe(false);
    expect(status!.days_remaining).toBe(0);
  });
});
