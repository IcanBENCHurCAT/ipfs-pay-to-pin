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
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({
  eq: (...args: any[]) => mockEq(...args),
  maybeSingle: (...args: any[]) => mockMaybeSingle(...args)
});
const mockSelect = vi.fn().mockReturnValue({
  eq: (...args: any[]) => mockEq(...args)
});
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

    // Reset default mock behaviors
    mockEq.mockReturnValue({
      eq: (...args: any[]) => mockEq(...args),
      maybeSingle: (...args: any[]) => mockMaybeSingle(...args)
    });
    mockSelect.mockReturnValue({
      eq: (...args: any[]) => mockEq(...args)
    });

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

    describe('findByTxHash', () => {
      it('should return undefined when txHash is empty or falsy', async () => {
        const db = new DbManager('test_registry.json');

        const result1 = await db.findByTxHash('algorand:mainnet', '');
        const result2 = await db.findByTxHash('algorand:mainnet', null as any);

        expect(result1).toBeUndefined();
        expect(result2).toBeUndefined();
        expect(mockFrom).not.toHaveBeenCalled();
      });

      it('should return undefined when Supabase is disabled', async () => {
        const db = new DbManager('test_registry.json');

        const result = await db.findByTxHash('algorand:mainnet', '0x123tx');

        expect(result).toBeUndefined();
        expect(mockFrom).not.toHaveBeenCalled();
      });
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
      it('should return mapped QueueItem when txHash record is found in Supabase', async () => {
        const db = new DbManager('test_registry.json');
        const mockRecord = {
          cid: 'bafybeidme5h53xry6s7yhrssotw4nnevwlfidbkwno3hdo6wd4muqhylke',
          filename: 'tx_file.txt',
          size_bytes: 2048,
          pinned_at: '2026-01-01T00:00:00.000Z',
          expires_at: '2027-01-01T00:00:00.000Z',
          renewals_count: 3,
          status: 'PINNED',
          payment_network: 'eip155:1',
          tx_hash: '0xabc123',
          token_address: '0xusdc',
          payer_address: '0xpayer',
          amount_paid: '5000000',
          settlement_status: 'SETTLED'
        };

        mockMaybeSingle.mockResolvedValueOnce({ data: mockRecord, error: null });

        const item = await db.findByTxHash('eip155:1', '0xabc123');

        expect(mockFrom).toHaveBeenCalledWith('pin_records');
        expect(mockSelect).toHaveBeenCalledWith('*');
        expect(mockEq).toHaveBeenNthCalledWith(1, 'payment_network', 'eip155:1');
        expect(mockEq).toHaveBeenNthCalledWith(2, 'tx_hash', '0xabc123');
        expect(mockMaybeSingle).toHaveBeenCalledTimes(1);

        expect(item).toBeDefined();
        expect(item).toEqual({
          id: `job_${Date.parse('2026-01-01T00:00:00.000Z')}_hylke`,
          filename: 'tx_file.txt',
          cid: 'bafybeidme5h53xry6s7yhrssotw4nnevwlfidbkwno3hdo6wd4muqhylke',
          filePath: 'queue/recovered_bafybeidme5h53xry6s7yhrssotw4nnevwlfidbkwno3hdo6wd4muqhylke.bin',
          status: 'PINNED',
          retryCount: 0,
          createdAt: Date.parse('2026-01-01T00:00:00.000Z'),
          gatewayUrl: 'https://ipfs.io/ipfs/bafybeidme5h53xry6s7yhrssotw4nnevwlfidbkwno3hdo6wd4muqhylke',
          sizeBytes: 2048,
          pinned_at: Date.parse('2026-01-01T00:00:00.000Z'),
          expires_at: Date.parse('2027-01-01T00:00:00.000Z'),
          ttl_days: 365,
          renewalsCount: 3,
          paymentNetwork: 'eip155:1',
          txHash: '0xabc123',
          tokenAddress: '0xusdc',
          payerAddress: '0xpayer',
          amountPaid: 5000000,
          settlementStatus: 'SETTLED'
        });
      });

      it('should correctly apply default fallbacks for missing optional record fields', async () => {
        const db = new DbManager('test_registry.json');
        const mockRecord = {
          cid: 'Qm12345',
          filename: 'minimal.txt',
          status: 'PINNED'
        };

        mockMaybeSingle.mockResolvedValueOnce({ data: mockRecord, error: null });

        const item = await db.findByTxHash('algorand:mainnet', 'tx_fallback');

        expect(item).toBeDefined();
        expect(item?.paymentNetwork).toBe('algorand:mainnet');
        expect(item?.txHash).toBeUndefined();
        expect(item?.tokenAddress).toBeUndefined();
        expect(item?.payerAddress).toBeUndefined();
        expect(item?.amountPaid).toBeUndefined();
        expect(item?.settlementStatus).toBe('SETTLED');
        expect(item?.sizeBytes).toBe(0);
        expect(item?.renewalsCount).toBe(0);
      });

      it('should return undefined when record is not found in Supabase', async () => {
        const db = new DbManager('test_registry.json');
        mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

        const item = await db.findByTxHash('algorand:mainnet', 'non_existent_tx');

        expect(item).toBeUndefined();
      });

      it('should return undefined when Supabase query returns an error', async () => {
        const db = new DbManager('test_registry.json');
        mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Database query error' } });

        const item = await db.findByTxHash('algorand:mainnet', '0xerror');

        expect(item).toBeUndefined();
      });

      it('should catch exception and return undefined when Supabase client throws', async () => {
        const db = new DbManager('test_registry.json');
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockMaybeSingle.mockRejectedValueOnce(new Error('Network connection lost'));

        const item = await db.findByTxHash('algorand:mainnet', '0xexception');

        expect(item).toBeUndefined();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[DbManager] Supabase txHash lookup failed'),
          expect.any(Error)
        );
        consoleWarnSpy.mockRestore();
      });
    });
  });
});
