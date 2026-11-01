import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  IpfsPayToPinClient,
  ConfigurationError,
  GatewayError,
  PinNotFoundError,
  InsufficientBudgetError,
  PaymentDeclinedError,
} from './index.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

const MOCK_EVM_KEY = '0x1111111111111111111111111111111111111111111111111111111111111111';

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
        evmPrivateKey: MOCK_EVM_KEY,
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

    it('throws ConfigurationError if mnemonic length is not 25 words', () => {
      expect(() => new IpfsPayToPinClient({ mnemonic: 'abandon abandon abandon' })).toThrowError(
        new ConfigurationError('[IpfsClient] Invalid mnemonic: Expected 25 words, got 3')
      );
    });

    it('throws ConfigurationError if mnemonic checksum or format is invalid', () => {
      const badMnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon WRONG';
      expect(() => new IpfsPayToPinClient({ mnemonic: badMnemonic })).toThrowError(
        new ConfigurationError('[IpfsClient] Failed to parse Algorand mnemonic: failed to decode mnemonic')
      );
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

    it('throws ConfigurationError if cid is invalid or empty', async () => {
      const client = new IpfsPayToPinClient({ evmPrivateKey: MOCK_EVM_KEY });

      // @ts-expect-error testing invalid argument
      await expect(client.getPinStatus(null)).rejects.toThrow(ConfigurationError);

      await expect(client.getPinStatus('')).rejects.toThrow(ConfigurationError);
      await expect(client.getPinStatus('   ')).rejects.toThrow(ConfigurationError);
    });

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
        evmPrivateKey: MOCK_EVM_KEY,
      });
      const status = await client.getPinStatus(testCid);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `https://pay-to-pin.duckdns.org/api/v1/pin/${testCid}`
      );
      expect(status).toEqual(mockStatusData);
    });

    it('throws PinNotFoundError when API call fails with 404', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { message: 'CID not found' },
        },
      });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
      });

      await expect(client.getPinStatus(testCid)).rejects.toThrow(PinNotFoundError);
    });

    it('throws GatewayError when API call fails with non-404 status', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
      });

      await expect(client.getPinStatus(testCid)).rejects.toThrow(GatewayError);
    });
  });

  describe('pinFile', () => {
    it('throws ConfigurationError if options or options.filename or options.data is missing', async () => {
      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
      });

      // @ts-expect-error testing invalid argument
      await expect(client.pinFile(null)).rejects.toThrowError(new ConfigurationError('[IpfsClient] Missing required pinFile options.'));
      // @ts-expect-error testing invalid argument
      await expect(client.pinFile({ data: 'hello' })).rejects.toThrowError(new ConfigurationError('[IpfsClient] Expected options.filename to be a non-empty string, got undefined'));
      // @ts-expect-error testing invalid argument
      await expect(client.pinFile({ filename: 'file.txt' })).rejects.toThrowError(new ConfigurationError('[IpfsClient] Expected options.data to be a Buffer or string, got undefined'));
    });

    it('throws ConfigurationError if options.data is not a string or Buffer', async () => {
      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
      });

      // @ts-expect-error testing invalid data type
      await expect(client.pinFile({ filename: 'test.txt', data: 123 })).rejects.toThrowError(
        new ConfigurationError('[IpfsClient] Expected options.data to be a Buffer or string, got number')
      );

      // @ts-expect-error testing invalid data type
      await expect(client.pinFile({ filename: 'test.txt', data: {} })).rejects.toThrowError(
        new ConfigurationError('[IpfsClient] Expected options.data to be a Buffer or string, got object')
      );
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
        evmPrivateKey: MOCK_EVM_KEY,
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
        evmPrivateKey: MOCK_EVM_KEY,
      });

      await expect(
        client.pinFile({ filename: 'test.txt', data: 'hello' })
      ).rejects.toThrow(GatewayError);
    });

    it('handles 402 challenge, signs payment, and returns pinned response', async () => {
      const challengePayload = {
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '10000',
            payTo: '0x1111111111111111111111111111111111111111',
          },
        ],
      };
      const headerVal = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

      const mock402Error = {
        response: {
          status: 402,
          headers: {
            'payment-required': headerVal,
          },
          data: { message: 'Payment Required' },
        },
      };

      const mockSuccessRes = {
        status: 'pinned',
        message: 'File pinned successfully via payment',
        filename: 'paid.txt',
        ipfs_cid: 'bafybeipaid...',
        cid: 'bafybeipaid...',
        gateway_url: 'https://ipfs.io/ipfs/bafybeipaid...',
        pinned_at: '2025-01-01T00:00:00Z',
        expires_at: '2026-01-01T00:00:00Z',
        ttl_days: 365,
        renewal_url: 'https://pay-to-pin.duckdns.org/api/v1/renew',
      };

      mockedAxios.post
        .mockRejectedValueOnce(mock402Error)
        .mockResolvedValueOnce({ data: mockSuccessRes });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
      });

      // Mock x402ClientInstance.createPaymentPayload to test orchestration without external signer dependency
      vi.spyOn((client as any).x402ClientInstance, 'createPaymentPayload').mockResolvedValueOnce({
        x402Version: 2,
        payload: { sig: 'mock-signature' },
      });

      const res = await client.pinFile({
        filename: 'paid.txt',
        data: Buffer.from('hello paid world'),
      });

      expect(res).toEqual(mockSuccessRes);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('throws InsufficientBudgetError when 402 challenge price exceeds maxPriceUsdc', async () => {
      const challengePayload = {
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '2000000', // $2.00 USDC > maxPriceUsdc ($0.50)
            payTo: '0x1111111111111111111111111111111111111111',
          },
        ],
      };
      const headerVal = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

      const mock402Error = {
        response: {
          status: 402,
          headers: {
            'payment-required': headerVal,
          },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mock402Error);

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
        maxPriceUsdc: 0.50,
      });

      await expect(
        client.pinFile({ filename: 'expensive.txt', data: 'hello' })
      ).rejects.toThrow(InsufficientBudgetError);
    });

    it('throws PaymentDeclinedError when confirmPrice callback returns false', async () => {
      const challengePayload = {
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '10000',
            payTo: '0x1111111111111111111111111111111111111111',
          },
        ],
      };
      const headerVal = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

      const mock402Error = {
        response: {
          status: 402,
          headers: {
            'payment-required': headerVal,
          },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mock402Error);

      const confirmPrice = vi.fn().mockResolvedValue(false);

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
        confirmPrice,
      });

      await expect(
        client.pinFile({ filename: 'declined.txt', data: 'hello' })
      ).rejects.toThrow(PaymentDeclinedError);

      expect(confirmPrice).toHaveBeenCalledWith(0.01, 'declined.txt', 'eip155:8453');
    });

    it('proceeds with payment when confirmPrice callback returns true', async () => {
      const challengePayload = {
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '10000',
            payTo: '0x1111111111111111111111111111111111111111',
          },
        ],
      };
      const headerVal = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

      const mock402Error = {
        response: {
          status: 402,
          headers: {
            'payment-required': headerVal,
          },
        },
      };

      const mockSuccessRes = {
        status: 'pinned',
        cid: 'bafybeiapproved...',
      };

      mockedAxios.post
        .mockRejectedValueOnce(mock402Error)
        .mockResolvedValueOnce({ data: mockSuccessRes });

      const confirmPrice = vi.fn().mockResolvedValue(true);

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
        confirmPrice,
      });

      vi.spyOn((client as any).x402ClientInstance, 'createPaymentPayload').mockResolvedValueOnce({
        x402Version: 2,
        payload: { sig: 'mock-sig' },
      });

      const res = await client.pinFile({ filename: 'approved.txt', data: 'hello' });
      expect(res).toEqual(mockSuccessRes);
      expect(confirmPrice).toHaveBeenCalledWith(0.01, 'approved.txt', 'eip155:8453');
    });

    it('honors preferredNetwork configuration during network selection', async () => {
      const challengePayload = {
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453', // Base L2 (default priority 1)
            amount: '10000',
            payTo: '0x1111111111111111111111111111111111111111',
          },
          {
            scheme: 'exact',
            network: 'eip155:42161', // Arbitrum One
            amount: '10000',
            payTo: '0x1111111111111111111111111111111111111111',
          },
        ],
      };
      const headerVal = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

      const mock402Error = {
        response: {
          status: 402,
          headers: {
            'payment-required': headerVal,
          },
        },
      };

      const mockSuccessRes = {
        status: 'pinned',
        cid: 'bafybeiarbitrum...',
      };

      mockedAxios.post
        .mockRejectedValueOnce(mock402Error)
        .mockResolvedValueOnce({ data: mockSuccessRes });

      const confirmPrice = vi.fn().mockResolvedValue(true);

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
        preferredNetwork: 'eip155:42161',
        confirmPrice,
      });

      vi.spyOn((client as any).x402ClientInstance, 'createPaymentPayload').mockResolvedValueOnce({
        x402Version: 2,
        payload: { sig: 'mock-arbitrum-sig' },
      });

      await client.pinFile({ filename: 'arbitrum.txt', data: 'hello' });
      expect(confirmPrice).toHaveBeenCalledWith(0.01, 'arbitrum.txt', 'eip155:42161');
    });
  });

  describe('renewPin', () => {
    it('throws ConfigurationError if cid is invalid or empty', async () => {
      const client = new IpfsPayToPinClient({ evmPrivateKey: MOCK_EVM_KEY });

      // @ts-expect-error testing invalid argument
      await expect(client.renewPin(null)).rejects.toThrow(ConfigurationError);

      await expect(client.renewPin('')).rejects.toThrow(ConfigurationError);
      await expect(client.renewPin('   ')).rejects.toThrow(ConfigurationError);
    });

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
        evmPrivateKey: MOCK_EVM_KEY,
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
        evmPrivateKey: MOCK_EVM_KEY,
      });

      await expect(client.renewPin('bafybeid...')).rejects.toThrow(GatewayError);
    });

    it('throws PinNotFoundError when renewal fails with 404', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { message: 'CID not found' },
        },
      });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
      });

      await expect(client.renewPin('bafybeid...')).rejects.toThrow(PinNotFoundError);
    });

    it('handles 402 challenge and settles paid renewal', async () => {
      const challengePayload = {
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '5000',
            payTo: '0x1111111111111111111111111111111111111111',
          },
        ],
      };
      const headerVal = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

      const mock402Error = {
        response: {
          status: 402,
          headers: {
            'payment-required': headerVal,
          },
          data: { message: 'Payment Required' },
        },
      };

      const mockSuccessRes = {
        status: 'renewed',
        message: 'Pin renewed for 365 days',
        cid: 'bafybeirenew402...',
        expires_at: '2028-01-01T00:00:00Z',
        renewals_count: 2,
      };

      mockedAxios.post
        .mockRejectedValueOnce(mock402Error)
        .mockResolvedValueOnce({ data: mockSuccessRes });

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
      });

      vi.spyOn((client as any).x402ClientInstance, 'createPaymentPayload').mockResolvedValueOnce({
        x402Version: 2,
        payload: { sig: 'mock-renew-sig' },
      });

      const res = await client.renewPin('bafybeirenew402...');
      expect(res).toEqual(mockSuccessRes);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('throws InsufficientBudgetError when renewal 402 price exceeds maxPriceUsdc', async () => {
      const challengePayload = {
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000', // $1.00 USDC > maxPriceUsdc ($0.005)
            payTo: '0x1111111111111111111111111111111111111111',
          },
        ],
      };
      const headerVal = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

      const mock402Error = {
        response: {
          status: 402,
          headers: {
            'payment-required': headerVal,
          },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mock402Error);

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
        maxPriceUsdc: 0.005,
      });

      await expect(client.renewPin('bafybeiexpensive...')).rejects.toThrow(InsufficientBudgetError);
    });

    it('throws PaymentDeclinedError when confirmPrice callback declines renewal', async () => {
      const challengePayload = {
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '5000',
            payTo: '0x1111111111111111111111111111111111111111',
          },
        ],
      };
      const headerVal = Buffer.from(JSON.stringify(challengePayload)).toString('base64');

      const mock402Error = {
        response: {
          status: 402,
          headers: {
            'payment-required': headerVal,
          },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mock402Error);

      const confirmPrice = vi.fn().mockResolvedValue(false);

      const client = new IpfsPayToPinClient({
        evmPrivateKey: MOCK_EVM_KEY,
        confirmPrice,
      });

      await expect(client.renewPin('bafybeideclined...')).rejects.toThrow(PaymentDeclinedError);
      expect(confirmPrice).toHaveBeenCalledWith(0.005, 'Renewal for CID bafybeideclined...', 'eip155:8453');
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

      const err5 = new PinNotFoundError('CID not found');
      expect(err5).toBeInstanceOf(PinNotFoundError);
      expect(err5).toBeInstanceOf(GatewayError);
      expect(err5.name).toBe('PinNotFoundError');
      expect(err5.status).toBe(404);
    });
  });
});
