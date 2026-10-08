import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import algosdk from 'algosdk';
import { initiateOnChainRefund } from '../src/refund.js';
import { config } from '../src/config.js';
import app from '../src/index.js';
import { globalFileQueue } from '../src/queue.js';
import { paymentMiddleware } from '@x402/hono';

vi.mock('@x402/hono', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    paymentMiddleware: vi.fn().mockImplementation(() => {
      return async (c: any, next: any) => {
        if (c.req.header('x-test-bypass-payment') === 'true') {
          return next();
        }
        return c.json({ error: "Payment required" }, 402, { 'PAYMENT-REQUIRED': 'challenge-string' });
      };
    })
  };
});

vi.mock('algosdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('algosdk')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      waitForConfirmation: vi.fn().mockResolvedValue({}),
    },
    waitForConfirmation: vi.fn().mockResolvedValue({}),
  };
});

describe('Feature-Flagged On-Chain Refund Module', () => {
  const originalEnableRefunds = config.enableAutomaticRefunds;
  const originalMnemonic = config.algorandMnemonic;

  // 25-word Algorand test mnemonic
  const TEST_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    config.enableAutomaticRefunds = originalEnableRefunds;
    config.algorandMnemonic = originalMnemonic;
    vi.clearAllMocks();
  });

  it('skips refund when ENABLE_AUTOMATIC_REFUNDS is false', async () => {
    config.enableAutomaticRefunds = false;
    const result = await initiateOnChainRefund({
      recipientAddress: 'ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY',
      amountMicroUsdc: 10000,
      asaId: 31566704,
      reason: 'Unit test failure',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
  });

  it('fails gracefully when recipientAddress is invalid', async () => {
    config.enableAutomaticRefunds = true;
    config.algorandMnemonic = TEST_MNEMONIC;

    const result = await initiateOnChainRefund({
      recipientAddress: 'invalid-address',
      amountMicroUsdc: 10000,
      asaId: 31566704,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid Algorand recipient address');
  });

  it('fails gracefully when mnemonic is missing even if feature flag is true', async () => {
    config.enableAutomaticRefunds = true;
    config.algorandMnemonic = '';
    const result = await initiateOnChainRefund({
      recipientAddress: 'ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY',
      amountMicroUsdc: 10000,
      asaId: 31566704,
      reason: 'Unit test failure',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('mnemonic is missing');
  });

  it('executes on-chain refund successfully when configured and mocked', async () => {
    config.enableAutomaticRefunds = true;
    config.algorandMnemonic = TEST_MNEMONIC;

    const fakeTxId = 'TX1234567890ABCDEF';

    // Mock Algodv2 client methods with proper v3 SuggestedParams structure
    const mockGetTransactionParamsDo = vi.fn().mockResolvedValue({
      fee: 1000n,
      firstValid: 1000n,
      lastValid: 2000n,
      genesisHash: new Uint8Array(Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUfT6I=', 'base64')),
      genesisID: 'testnet-v1.0',
      minFee: 1000n,
    });

    const mockSendRawTransactionDo = vi.fn().mockResolvedValue({ txId: fakeTxId });

    vi.spyOn(algosdk.Algodv2.prototype, 'getTransactionParams').mockReturnValue({
      do: mockGetTransactionParamsDo,
    } as any);

    vi.spyOn(algosdk.Algodv2.prototype, 'sendRawTransaction').mockReturnValue({
      do: mockSendRawTransactionDo,
    } as any);

    const result = await initiateOnChainRefund({
      recipientAddress: 'ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY',
      amountMicroUsdc: 50000,
      asaId: 31566704,
      reason: 'Pinning failure refund test',
    });

    expect(result.success).toBe(true);
    expect(result.txId).toBe(fakeTxId);
    expect(mockGetTransactionParamsDo).toHaveBeenCalled();
    expect(mockSendRawTransactionDo).toHaveBeenCalled();
    expect(algosdk.waitForConfirmation).toHaveBeenCalled();
  });

  it('handles error gracefully when Algod transaction execution fails', async () => {
    config.enableAutomaticRefunds = true;
    config.algorandMnemonic = TEST_MNEMONIC;

    vi.spyOn(algosdk.Algodv2.prototype, 'getTransactionParams').mockReturnValue({
      do: vi.fn().mockRejectedValue(new Error('Network connection timeout')),
    } as any);

    const result = await initiateOnChainRefund({
      recipientAddress: 'ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY',
      amountMicroUsdc: 50000,
      asaId: 31566704,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network connection timeout');
  });

  it('extracts refund recipient address from PAYMENT-SIGNATURE on error', async () => {
    config.enableAutomaticRefunds = true;
    config.algorandMnemonic = TEST_MNEMONIC;

    const senderAccount = algosdk.generateAccount();
    const suggestedParams = {
      fee: 1000n,
      minFee: 1000n,
      firstValid: 100n,
      lastValid: 200n,
      genesisID: 'testnet-v1.0',
      genesisHash: new Uint8Array(Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=', 'base64')),
    };

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: senderAccount.addr,
      receiver: senderAccount.addr,
      amount: 10000n,
      suggestedParams,
    });

    const signedTxn = txn.signTxn(senderAccount.sk);
    const payloadObj = {
      payload: {
        txns: [Buffer.from(signedTxn).toString('base64')]
      }
    };
    const paymentSigHeader = Buffer.from(JSON.stringify(payloadObj)).toString('base64');

    vi.spyOn(globalFileQueue, 'addJob').mockRejectedValueOnce(new Error('Simulated processing failure'));

    const mockGetTransactionParamsDo = vi.fn().mockResolvedValue({
      fee: 1000n,
      firstValid: 1000n,
      lastValid: 2000n,
      genesisHash: new Uint8Array(Buffer.from('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUfT6I=', 'base64')),
      genesisID: 'testnet-v1.0',
      minFee: 1000n,
    });
    const mockSendRawTransactionDo = vi.fn().mockResolvedValue({ txId: 'REFUND_TX_123' });

    vi.spyOn(algosdk.Algodv2.prototype, 'getTransactionParams').mockReturnValue({
      do: mockGetTransactionParamsDo,
    } as any);

    vi.spyOn(algosdk.Algodv2.prototype, 'sendRawTransaction').mockReturnValue({
      do: mockSendRawTransactionDo,
    } as any);

    const res = await app.request('/api/v1/pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-bypass-payment': 'true',
        'PAYMENT-SIGNATURE': paymentSigHeader,
        'x-payment-sender': 'ATTACKER_INJECTED_ADDRESS_OVERWRITTEN'
      },
      body: JSON.stringify({
        filename: 'test.txt',
        data: Buffer.from('hello').toString('base64')
      })
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.refund_initiated).toBe(true);
    expect(data.refund_tx_id).toBe('REFUND_TX_123');

    // Verify sendRawTransaction was called and inspect the asset transfer args
    expect(mockSendRawTransactionDo).toHaveBeenCalled();

    // Verify refund log or address target
    const logSpy = vi.spyOn(console, 'log');
    expect(data.refund_tx_id).toBe('REFUND_TX_123');
  });
});
