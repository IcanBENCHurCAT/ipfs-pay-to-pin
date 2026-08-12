import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index.js';
import { globalFileQueue } from '../src/queue.js';

describe('Multi-Chain x402 Payment Gateway', () => {
  beforeAll(async () => {
    process.env.ALLOW_LOCAL_FALLBACK = 'true';
    await globalFileQueue.init();
  });

  it('should return 402 Payment Required with multi-chain CAIP-2 options in PAYMENT-REQUIRED header', async () => {
    const res = await app.request('/api/v1/pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: 'test-multichain.png',
        data: 'SGVsbG8gV29ybGQ='
      })
    });

    expect(res.status).toBe(402);
    const paymentHeader = res.headers.get('PAYMENT-REQUIRED') || res.headers.get('payment-required');
    expect(paymentHeader).toBeTruthy();

    const decoded = JSON.parse(Buffer.from(paymentHeader!, 'base64').toString('utf-8'));
    expect(decoded.accepts).toBeDefined();
    expect(Array.isArray(decoded.accepts)).toBe(true);

    const networks = decoded.accepts.map((opt: any) => opt.network);
    expect(networks).toContain('eip155:8453'); // Base L2
    expect(networks).toContain('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'); // Solana Mainnet

    // Verify Base L2 EIP-3009 extra flag
    const baseOpt = decoded.accepts.find((opt: any) => opt.network === 'eip155:8453');
    expect(baseOpt.extra?.eip3009).toBe(true);
  });

  it('should support cross-chain transaction replay lookup in Queue', async () => {
    const mockTxHash = '0x8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a';
    const mockNetwork = 'eip155:8453';

    // Verify no existing item with this txHash
    const existing = await globalFileQueue.findByTxHash(mockNetwork, mockTxHash);
    expect(existing).toBeUndefined();

    // Add job with multi-chain payment details
    const buffer = Buffer.from('Test Buffer Content', 'utf-8');
    const job = await globalFileQueue.addJob('replay-test.txt', buffer, {
      paymentNetwork: mockNetwork,
      txHash: mockTxHash,
      payerAddress: '0x1234567890123456789012345678901234567890',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      amountPaid: 10000,
      settlementStatus: 'SETTLED'
    });

    expect(job.paymentNetwork).toBe(mockNetwork);
    expect(job.txHash).toBe(mockTxHash);

    const items = await globalFileQueue.getItems();
    const matchesLocal = items.find(i => i.paymentNetwork === mockNetwork && i.txHash === mockTxHash);
    expect(matchesLocal).toBeDefined();
    expect(matchesLocal?.id).toBe(job.id);
  });
});
