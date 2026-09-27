import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import algosdk from 'algosdk';
import { initiateOnChainRefund } from '../src/refund.js';
import { config } from '../src/config.js';

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
});
