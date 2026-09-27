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
            status: 'PINNED',
            payment_network: 'algorand:mainnet',
            tx_hash: null,
            payer_address: null,
            token_address: null,
            amount_paid: null,
            settlement_status: 'SETTLED'
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

    it('should fetch from Supabase, and return mapped items on getItems success (without redundant disk writes)', async () => {
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

      // ⚡ Bolt: We specifically ensure mockWriteFile is NOT called here anymore
      expect(mockWriteFile).not.toHaveBeenCalled();
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

    describe('findByTxHash', () => {
      it('should return undefined if txHash is falsy without calling Supabase', async () => {
        const db = new DbManager('test_registry.json');

        const result = await db.findByTxHash('algorand:mainnet', '');

        expect(result).toBeUndefined();
        expect(mockFrom).not.toHaveBeenCalled();
      });

      it('should return mapped QueueItem when Supabase query returns matching record', async () => {
        const db = new DbManager('test_registry.json');
        const mockRecord = {
          cid: 'Qm12345',
          filename: 'test.txt',
          size_bytes: 500,
          pinned_at: '2026-08-01T00:00:00.000Z',
          expires_at: '2027-08-01T00:00:00.000Z',
          renewals_count: 1,
          status: 'PINNED',
          payment_network: 'algorand:mainnet',
          tx_hash: '0x123abc',
          token_address: '0xtoken',
          payer_address: '0xpayer',
          amount_paid: '1000',
          settlement_status: 'SETTLED'
        };

        const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockRecord, error: null });
        const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        mockSelect.mockReturnValueOnce({ eq: mockEq1 });

        const result = await db.findByTxHash('algorand:mainnet', '0x123abc');

        expect(mockFrom).toHaveBeenCalledWith('pin_records');
        expect(mockSelect).toHaveBeenCalledWith('*');
        expect(mockEq1).toHaveBeenCalledWith('payment_network', 'algorand:mainnet');
        expect(mockEq2).toHaveBeenCalledWith('tx_hash', '0x123abc');
        expect(mockMaybeSingle).toHaveBeenCalled();

        expect(result).toBeDefined();
        expect(result?.cid).toBe('Qm12345');
        expect(result?.filename).toBe('test.txt');
        expect(result?.sizeBytes).toBe(500);
        expect(result?.renewalsCount).toBe(1);
        expect(result?.status).toBe('PINNED');
        expect(result?.paymentNetwork).toBe('algorand:mainnet');
        expect(result?.txHash).toBe('0x123abc');
        expect(result?.tokenAddress).toBe('0xtoken');
        expect(result?.payerAddress).toBe('0xpayer');
        expect(result?.amountPaid).toBe(1000);
        expect(result?.settlementStatus).toBe('SETTLED');
      });

      it('should log a warning and return undefined when Supabase lookup fails/throws an error', async () => {
        const db = new DbManager('test_registry.json');
        const mockError = new Error('Supabase query exception');

        const mockMaybeSingle = vi.fn().mockRejectedValue(mockError);
        const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        mockSelect.mockReturnValueOnce({ eq: mockEq1 });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await db.findByTxHash('algorand:mainnet', '0x123abc');

        expect(result).toBeUndefined();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[DbManager] Supabase txHash lookup failed, checking local cache:',
          mockError
        );

        consoleWarnSpy.mockRestore();
      });

      it('should return undefined when Supabase returns an error object without throwing', async () => {
        const db = new DbManager('test_registry.json');

        const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } });
        const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        mockSelect.mockReturnValueOnce({ eq: mockEq1 });

        const result = await db.findByTxHash('algorand:mainnet', '0x123abc');

        expect(result).toBeUndefined();
      });
    });
  });
});
