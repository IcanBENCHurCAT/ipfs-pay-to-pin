import crypto from 'crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { globalFileQueue } from '../src/queue.js';

// The x402 payment middleware in src/index.ts initializes against the live
// payment facilitator (GET {FACILITATOR_URL}/supported) and awaits that
// network call inside the first protected request before it can build the
// 402 response. Facilitator latency alone measured 1-5s, which made this
// suite flaky at Vitest's 5000ms default timeout (timed out in CI run
// 39359773066; the identical tree passed in 1033ms on run 39359457723).
// Stub the facilitator's /supported endpoint with a snapshot of its real
// response so the suite is hermetic and offline-safe. All other URLs pass
// through to the real fetch.
const FACILITATOR_BASE = (process.env.FACILITATOR_URL || 'https://facilitator.goplausible.xyz').replace(/\/$/, '');
const FACILITATOR_SUPPORTED = {
  kinds: [
    { x402Version: 2, scheme: 'exact', network: 'eip155:8453' },
    { x402Version: 2, scheme: 'exact', network: 'eip155:84532' },
    {
      x402Version: 2,
      scheme: 'exact',
      network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      extra: { feePayer: '8a8fFNfk2AGS7rgVv1BoqPUWnzQuoCrShJV8tSE6RAYi' }
    },
    {
      x402Version: 2,
      scheme: 'exact',
      network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      extra: { feePayer: '8a8fFNfk2AGS7rgVv1BoqPUWnzQuoCrShJV8tSE6RAYi' }
    },
    {
      x402Version: 2,
      scheme: 'exact',
      network: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
      extra: { feePayer: 'ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA' }
    },
    {
      x402Version: 2,
      scheme: 'exact',
      network: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      extra: { feePayer: 'ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA' }
    }
  ],
  extensions: [] as string[],
  signers: {
    'eip155:*': ['0x136008978ad053942dCDBE759A0903f5d84966fa'],
    'solana:*': ['8a8fFNfk2AGS7rgVv1BoqPUWnzQuoCrShJV8tSE6RAYi'],
    'algorand:*': ['ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA']
  }
};

const realFetch = globalThis.fetch;
function stubFacilitatorSupported(): void {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request)?.url ?? '';
    if (url === `${FACILITATOR_BASE}/supported`) {
      return new Response(JSON.stringify(FACILITATOR_SUPPORTED), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return realFetch(input as never, init);
  }) as typeof fetch;
}

let app: Awaited<ReturnType<typeof loadApp>>;
async function loadApp() {
  const mod = await import('../src/index.js');
  return mod.default;
}

describe('Multi-Chain x402 Payment Gateway', () => {
  beforeAll(async () => {
    process.env.ALLOW_LOCAL_FALLBACK = 'true';
    // Install the facilitator stub BEFORE importing the app: the payment
    // middleware starts facilitator initialization at import time.
    stubFacilitatorSupported();
    app = await loadApp();
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
    const randomHex = crypto.randomBytes(8).toString('hex');
    const mockTxHash = `0x8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a${randomHex}`;
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
