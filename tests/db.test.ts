import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DbManager } from '../src/db.js';
import { config } from '../src/config.js';

// Setup Mock for fs
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockRename = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue(JSON.stringify([]));

vi.mock('fs', () => {
  return {
    default: {
      promises: {
        writeFile: (...args: any[]) => mockWriteFile(...args),
        rename: (...args: any[]) => mockRename(...args),
        readFile: (...args: any[]) => mockReadFile(...args)
      }
    }
  };
});

// Setup Mock for Supabase
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn().mockReturnValue({
  upsert: mockUpsert,
  select: mockSelect
});
const mockSupabaseClient = {
  from: mockFrom
};

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => mockSupabaseClient)
  };
});

describe('DbManager', () => {
  let originalUrl: string | undefined;
  let originalKey: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalUrl = config.supabaseUrl;
    originalKey = config.supabaseKey;

    // Default config values: disabled
    config.supabaseUrl = '';
    config.supabaseKey = '';
  });

  afterEach(() => {
    config.supabaseUrl = originalUrl || '';
    config.supabaseKey = originalKey || '';
  });

  describe('Local File Only Fallback (Supabase Disabled)', () => {
    it('should save items only to the local file system using atomic writes', async () => {
      const db = new DbManager('test_registry.json');
      const items = [
        {
          id: 'job_1',
          filename: 'test.txt',
          cid: 'Qm123',
          filePath: 'queue/test.txt',
          status: 'PENDING' as const,
          retryCount: 0,
          createdAt: Date.now(),
          gatewayUrl: 'https://ipfs.io/ipfs/Qm123',
          sizeBytes: 100,
          pinned_at: Date.now(),
          expires_at: Date.now() + 10000,
          ttl_days: 365,
          renewalsCount: 0
        }
      ];

      await db.saveItems(items);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [tempPath, dataStr] = mockWriteFile.mock.calls[0];
      expect(tempPath).toContain('test_registry.json.tmp.');
      expect(JSON.parse(dataStr)).toEqual(items);

      expect(mockRename).toHaveBeenCalledTimes(1);
      expect(mockRename).toHaveBeenCalledWith(tempPath, 'test_registry.json');

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should get items from local file system when supabase is disabled', async () => {
      const db = new DbManager('test_registry.json');
      const expectedItems = [{ id: 'job_1', cid: 'Qm123' }];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(expectedItems));

      const items = await db.getItems();

      expect(mockReadFile).toHaveBeenCalledWith('test_registry.json', 'utf-8');
      expect(items).toEqual(expectedItems);
    });

    it('should return empty array if local file read fails and supabase is disabled', async () => {
      const db = new DbManager('test_registry.json');
      mockReadFile.mockRejectedValueOnce(new Error('File not found'));

      const items = await db.getItems();

      expect(items).toEqual([]);
    });
  });

  describe('Supabase Synced Mode (Supabase Enabled)', () => {
    beforeEach(() => {
      config.supabaseUrl = 'https://mock.supabase.co';
      config.supabaseKey = 'mock-key';
    });

    it('should initialize and call Supabase client upsert on saveItems', async () => {
      const db = new DbManager('test_registry.json');
      const items = [
        {
          id: 'job_1',
          filename: 'test.txt',
          cid: 'Qm123',
          filePath: 'queue/test.txt',
          status: 'PINNED' as const,
          retryCount: 0,
          createdAt: 1786484034000,
          gatewayUrl: 'https://ipfs.io/ipfs/Qm123',
          sizeBytes: 100,
          pinned_at: 1786484034000,
          expires_at: 1786484034000 + 365 * 24 * 60 * 60 * 1000,
          ttl_days: 365,
          renewalsCount: 1
        }
      ];

      mockUpsert.mockResolvedValueOnce({ error: null });

      await db.saveItems(items);

      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockRename).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith('pin_records');
      expect(mockUpsert).toHaveBeenCalledWith(
        [
          {
            cid: 'Qm123',
            filename: 'test.txt',
            size_bytes: 100,
            pinned_at: new Date(1786484034000).toISOString(),
            expires_at: new Date(1786484034000 + 365 * 24 * 60 * 60 * 1000).toISOString(),
            renewals_count: 1,
            status: 'PINNED'
          }
        ],
        { onConflict: 'cid' }
      );
    });

    it('should log an error if Supabase upsert fails', async () => {
      const db = new DbManager('test_registry.json');
      const items = [
        {
          id: 'job_1',
          filename: 'test.txt',
          cid: 'Qm123',
          status: 'PINNED' as const,
          retryCount: 0,
          createdAt: 1786484034000
        }
      ];

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUpsert.mockResolvedValueOnce({ error: { message: 'DB Error' } });

      await db.saveItems(items);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DbManager] Failed to batch sync 1 items to Supabase:'),
        { message: 'DB Error' }
      );
      consoleErrorSpy.mockRestore();
    });

    it('should fetch from Supabase, write to local fallback, and return mapped items on getItems success', async () => {
      const db = new DbManager('test_registry.json');
      const mockRecord = {
        cid: 'Qm123',
        filename: 'test.txt',
        size_bytes: 100,
        pinned_at: '2026-08-01T00:00:00.000Z',
        expires_at: '2027-08-01T00:00:00.000Z',
        renewals_count: 2,
        status: 'PINNED'
      };

      mockSelect.mockResolvedValueOnce({ data: [mockRecord], error: null });

      const items = await db.getItems();

      expect(mockFrom).toHaveBeenCalledWith('pin_records');
      expect(mockSelect).toHaveBeenCalled();

      expect(items).toHaveLength(1);
      const item = items[0];
      expect(item.cid).toBe('Qm123');
      expect(item.filename).toBe('test.txt');
      expect(item.sizeBytes).toBe(100);
      expect(item.renewalsCount).toBe(2);
      expect(item.status).toBe('PINNED');
      expect(item.createdAt).toBe(Date.parse('2026-08-01T00:00:00.000Z'));

      expect(mockWriteFile).toHaveBeenCalledWith(
        'test_registry.json',
        expect.stringContaining('"cid": "Qm123"')
      );
    });

    it('should fall back to local registry read if Supabase fetch returns error', async () => {
      const db = new DbManager('test_registry.json');
      mockSelect.mockResolvedValueOnce({ data: null, error: { message: 'Fetch error' } });

      const localItems = [{ id: 'job_local', cid: 'QmLocal' }];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(localItems));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const items = await db.getItems();

      expect(items).toEqual(localItems);
      expect(mockReadFile).toHaveBeenCalledWith('test_registry.json', 'utf-8');
      consoleWarnSpy.mockRestore();
    });

    it('should fall back to local registry read if Supabase fetch throws an exception', async () => {
      const db = new DbManager('test_registry.json');
      mockSelect.mockRejectedValueOnce(new Error('Network error'));

      const localItems = [{ id: 'job_local', cid: 'QmLocal' }];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(localItems));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const items = await db.getItems();

      expect(items).toEqual(localItems);
      expect(mockReadFile).toHaveBeenCalledWith('test_registry.json', 'utf-8');
      consoleWarnSpy.mockRestore();
    });
  });
});
