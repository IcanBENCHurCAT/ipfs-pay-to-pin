import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  IpfsPayToPinClient,
  ConfigurationError,
  GatewayError,
  InsufficientBudgetError,
  PaymentDeclinedError
} from '../src/index';

vi.mock('axios');

describe('IpfsPayToPinClient', () => {
  // A valid 25-word Algorand mnemonic for testing
  const mockMnemonic = 'repeat off clinic tone give buzz pencil moon uncover rule giggle tower energy mean give course name equal shaft victory deputy add melody above frequent';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor', () => {
    it('throws ConfigurationError if no wallet key is provided', () => {
      expect(() => new IpfsPayToPinClient({})).toThrow(ConfigurationError);
    });

    it('initializes successfully with a mnemonic', () => {
      const client = new IpfsPayToPinClient({ mnemonic: mockMnemonic });
      expect(client).toBeInstanceOf(IpfsPayToPinClient);
    });
  });

  describe('getPinStatus', () => {
    it('returns pin status data on success', async () => {
      const mockData = { pinned_at: '2025-01-01', is_active: true };
      vi.mocked(axios.get).mockResolvedValue({ data: mockData });

      const client = new IpfsPayToPinClient({ mnemonic: mockMnemonic });
      const status = await client.getPinStatus('bafybeig...');

      expect(status).toEqual(mockData);
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/v1/pin/bafybeig...'));
    });

    it('throws GatewayError on failure', async () => {
      vi.mocked(axios.get).mockRejectedValue({
        response: { status: 404, data: { error: 'Not found' } }
      });

      const client = new IpfsPayToPinClient({ mnemonic: mockMnemonic });
      await expect(client.getPinStatus('bafybeig...')).rejects.toThrow(GatewayError);
    });
  });

  describe('pinFile', () => {
    const mockChallenge = {
      version: '1.0',
      accepts: [
        { network: 'algorand:mainnet', amount: '10000' }
      ]
    };

    // x402ClientInstance.createPaymentPayload returns an object that x402HTTPClient parses.
    // It looks at payload.v (or payload.version?) Wait, let's mock the encodePaymentSignatureHeader directly if it fails.
    // Let's just mock x402HttpClient.encodePaymentSignatureHeader

    it('successfully pins a file after 402 challenge', async () => {
      const client = new IpfsPayToPinClient({ mnemonic: mockMnemonic });

      vi.mocked(axios.post)
        .mockRejectedValueOnce({
          response: {
            status: 402,
            headers: { 'payment-required': Buffer.from(JSON.stringify(mockChallenge)).toString('base64') }
          }
        })
        .mockResolvedValueOnce({
          data: { cid: 'bafybeig...', gateway_url: 'https://...' }
        });

      // Mock internal methods to avoid crypto and versioning issues during testing
      vi.spyOn((client as any).x402ClientInstance, 'createPaymentPayload').mockResolvedValue({});
      vi.spyOn((client as any).x402HttpClient, 'encodePaymentSignatureHeader').mockReturnValue({ 'PAYMENT-SIGNATURE': 'mock' });

      const res = await client.pinFile({ filename: 'test.txt', data: 'hello' });
      expect(res.cid).toBe('bafybeig...');
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('throws InsufficientBudgetError if price exceeds maxPriceUsdc', async () => {
      const client = new IpfsPayToPinClient({
        mnemonic: mockMnemonic,
        maxPriceUsdc: 0.005 // 5000 microUSDC
      });

      vi.mocked(axios.post).mockRejectedValueOnce({
        response: {
          status: 402,
          headers: { 'payment-required': Buffer.from(JSON.stringify(mockChallenge)).toString('base64') }
        }
      });

      await expect(client.pinFile({ filename: 'test.txt', data: 'hello' }))
        .rejects.toThrow(InsufficientBudgetError);
    });

    it('throws PaymentDeclinedError if confirmPrice returns false', async () => {
      const client = new IpfsPayToPinClient({
        mnemonic: mockMnemonic,
        confirmPrice: async () => false
      });

      vi.mocked(axios.post).mockRejectedValueOnce({
        response: {
          status: 402,
          headers: { 'payment-required': Buffer.from(JSON.stringify(mockChallenge)).toString('base64') }
        }
      });

      await expect(client.pinFile({ filename: 'test.txt', data: 'hello' }))
        .rejects.toThrow(PaymentDeclinedError);
    });
  });

  describe('renewPin', () => {
    const mockChallenge = {
      version: '1.0',
      accepts: [
        { network: 'algorand:mainnet', amount: '5000' }
      ]
    };

    it('successfully renews a pin after 402 challenge', async () => {
      const client = new IpfsPayToPinClient({ mnemonic: mockMnemonic });

      vi.mocked(axios.post)
        .mockRejectedValueOnce({
          response: {
            status: 402,
            headers: { 'payment-required': Buffer.from(JSON.stringify(mockChallenge)).toString('base64') }
          }
        })
        .mockResolvedValueOnce({
          data: { expires_at: '2026-01-01', renewals_count: 1 }
        });

      vi.spyOn((client as any).x402ClientInstance, 'createPaymentPayload').mockResolvedValue({});
      vi.spyOn((client as any).x402HttpClient, 'encodePaymentSignatureHeader').mockReturnValue({ 'PAYMENT-SIGNATURE': 'mock' });

      const res = await client.renewPin('bafybeig...');
      expect(res.expires_at).toBe('2026-01-01');
      expect(axios.post).toHaveBeenCalledTimes(2);
    });
  });
});
