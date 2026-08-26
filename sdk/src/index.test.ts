import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  IpfsPayToPinClient,
  ConfigurationError,
  GatewayError,
  InsufficientBudgetError,
  PaymentDeclinedError,
} from './index.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('IpfsPayToPinClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor & Configuration', () => {
    it('throws ConfigurationError when no wallet keys are provided', () => {
      expect(() => new IpfsPayToPinClient({})).toThrow(ConfigurationError);
      expect(() => new IpfsPayToPinClient({})).toThrow(
        'IpfsPayToPinClient requires at least one wallet key'
      );
    });

    it('instantiates successfully with EVM private key', () => {
      const client = new IpfsPayToPinClient({
        evmPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });
      expect(client).toBeInstanceOf(IpfsPayToPinClient);
      expect(client.getAddress()).toBe('multi-chain-wallet');
    });

    it('instantiates successfully with Solana private key', () => {
      const client = new IpfsPayToPinClient({
        solanaPrivateKey: 'mockSolanaPrivateKeyBase58',
      });
      expect(client).toBeInstanceOf(IpfsPayToPinClient);
      expect(client.getAddress()).toBe('multi-chain-wallet');
    });

    it('instantiates successfully with Algorand mnemonic and returns address/sender', () => {
      const testMnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest';
      const client = new IpfsPayToPinClient({
        mnemonic: testMnemonic,
      });
      expect(client).toBeInstanceOf(IpfsPayToPinClient);
      expect(client.getAddress()).toBeDefined();

      const clientWithSender = new IpfsPayToPinClient({
        mnemonic: testMnemonic,
        sender: 'CUSTOM_ALGORAND_SENDER_ADDRESS',
      });
      expect(clientWithSender.getAddress()).toBe('CUSTOM_ALGORAND_SENDER_ADDRESS');
    });
  });

  describe('getPinStatus', () => {
    const testCid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

    it('returns status data on successful API response', async () => {
      const mockStatusData = {
        pinned_at: '2025-01-01T00:00:00Z',
        expires_at: '2026-01-01T00:00:00Z',
        days_remaining: 365,
        is_active: true,
        ttl_days: 365,
        renewals_count: 0,
        renewal_url: `https://pay-to-pin.duckdns.org/api/v1/renew`,
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockStatusData });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });
      const status = await client.getPinStatus(testCid);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `https://pay-to-pin.duckdns.org/api/v1/pin/${testCid}`
      );
      expect(status).toEqual(mockStatusData);
    });

    it('throws GatewayError when API call fails', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { message: 'CID not found' },
        },
      });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      await expect(client.getPinStatus(testCid)).rejects.toThrow(GatewayError);
    });
  });

  describe('pinFile', () => {
    it('throws ConfigurationError if options or options.filename or options.data is missing', async () => {
      const client = new IpfsPayToPinClient({
        evmPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      // @ts-expect-error testing invalid argument
      await expect(client.pinFile(null)).rejects.toThrow(ConfigurationError);
      // @ts-expect-error testing invalid argument
      await expect(client.pinFile({ data: 'hello' })).rejects.toThrow(ConfigurationError);
      // @ts-expect-error testing invalid argument
      await expect(client.pinFile({ filename: 'file.txt' })).rejects.toThrow(ConfigurationError);
    });

    it('pins file without payment if server responds 200 directly', async () => {
      const mockSuccessRes = {
        status: 'pinned',
        message: 'File pinned successfully',
        filename: 'test.txt',
        ipfs_cid: 'bafybeid...',
        cid: 'bafybeid...',
        gateway_url: 'https://ipfs.io/ipfs/bafybeid...',
        pinned_at: '2025-01-01T00:00:00Z',
        expires_at: '2026-01-01T00:00:00Z',
        ttl_days: 365,
        renewal_url: 'https://pay-to-pin.duckdns.org/api/v1/renew',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockSuccessRes });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      const res = await client.pinFile({
        filename: 'test.txt',
        data: Buffer.from('hello world'),
      });

      expect(res).toEqual(mockSuccessRes);
    });

    it('throws GatewayError on non-402 server error', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      await expect(
        client.pinFile({ filename: 'test.txt', data: 'hello' })
      ).rejects.toThrow(GatewayError);
    });
  });

  describe('renewPin', () => {
    it('renews pin directly if server responds 200', async () => {
      const mockRenewRes = {
        status: 'renewed',
        message: 'Pin renewed for 365 days',
        cid: 'bafybeid...',
        expires_at: '2027-01-01T00:00:00Z',
        renewals_count: 1,
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockRenewRes });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      const res = await client.renewPin('bafybeid...');
      expect(res).toEqual(mockRenewRes);
    });

    it('throws GatewayError on non-402 server error during renewal', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { message: 'Renewal failed' },
        },
      });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      await expect(client.renewPin('bafybeid...')).rejects.toThrow(GatewayError);
    });
  });

  describe('Custom Error Classes', () => {
    it('instantiates custom errors correctly with super call and name', () => {
      const err1 = new InsufficientBudgetError('Budget exceeded');
      expect(err1).toBeInstanceOf(Error);
      expect(err1).toBeInstanceOf(InsufficientBudgetError);
      expect(err1.name).toBe('InsufficientBudgetError');
      expect(err1.message).toBe('Budget exceeded');

      const err2 = new PaymentDeclinedError('User declined');
      expect(err2).toBeInstanceOf(PaymentDeclinedError);
      expect(err2.name).toBe('PaymentDeclinedError');

      const err3 = new ConfigurationError('Bad config');
      expect(err3).toBeInstanceOf(ConfigurationError);
      expect(err3.name).toBe('ConfigurationError');

      const err4 = new GatewayError('Server error', 503);
      expect(err4).toBeInstanceOf(GatewayError);
      expect(err4.name).toBe('GatewayError');
      expect(err4.status).toBe(503);
    });
  });
});
