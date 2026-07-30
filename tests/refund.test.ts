import { describe, it, expect } from 'vitest';
import { initiateOnChainRefund } from '../src/refund.js';
import { config } from '../src/config.js';

describe('Feature-Flagged On-Chain Refund Module', () => {
  it('skips refund when ENABLE_AUTOMATIC_REFUNDS is false', async () => {
    config.enableAutomaticRefunds = false;
    const result = await initiateOnChainRefund({
      recipientAddress: 'ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY',
      amountMicroUsdc: 10000,
      asaId: 31566704,
      reason: 'Unit test failure'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
  });

  it('fails gracefully when mnemonic is missing even if feature flag is true', async () => {
    config.enableAutomaticRefunds = true;
    config.algorandMnemonic = '';
    const result = await initiateOnChainRefund({
      recipientAddress: 'ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY',
      amountMicroUsdc: 10000,
      asaId: 31566704,
      reason: 'Unit test failure'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('mnemonic is missing');
  });
});
