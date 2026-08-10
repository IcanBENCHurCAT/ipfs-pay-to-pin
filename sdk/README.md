# `ipfs-pay-to-pin-client`

TypeScript client library for pinning files to IPFS via the **IPFS Pay-to-Pin Gateway** using standard **x402 HTTP micropayments** settled in **Algorand microUSDC**.

- **Merchant Dashboard**: [GoPlausible Merchant Catalog](https://facilitator.goplausible.xyz/dashboard/merchants/c4f55ee4a1a2ae08)
- **Live Gateway API**: `https://pay-to-pin.duckdns.org`
- **Protocol Standard**: HTTP `402 Payment Required` via `@x402/core` & `@x402/avm`

---

## Overview

The IPFS Pay-to-Pin Gateway eliminates the need to sign up for monthly SaaS subscriptions or manage Pinata API keys when uploading files to IPFS.

With an Algorand wallet containing microUSDC (ASA `31566704`), any script or agent can upload a file, receive an HTTP `402 Payment Required` challenge, sign the microUSDC payment transaction on-chain, and receive an instant 365-day IPFS pin confirmation.

---

## Installation

```bash
npm install ipfs-pay-to-pin-client @x402/core @x402/avm algosdk
```

---

## Quickstart

### 1. Upload & Pin a File

```typescript
import { IpfsPayToPinClient } from 'ipfs-pay-to-pin-client';

const client = new IpfsPayToPinClient({
  mnemonic: 'your 25 word algorand wallet mnemonic here...',
  sender: 'OPTIONAL_ASSET_HOLDING_ADDRESS', // Use if wallet is re-keyed
  network: 'mainnet', // 'mainnet' (default) or 'testnet'
  maxPriceUsdc: 0.10 // optional max spend budget cap in USDC (default: $1.00)
});

async function main() {
  const fileBuffer = Buffer.from('Hello IPFS Pay-to-Pin!');

  const result = await client.pinFile({
    filename: 'hello.txt',
    data: fileBuffer
  });

  console.log('Pinned CID:', result.cid);
  console.log('Gateway URL:', result.gateway_url);
  console.log('Expires At:', result.expires_at);
}

main().catch(console.error);
```

### 2. Renew an Existing Pin (50% Early Renewal Discount)

```typescript
const renewalResult = await client.renewPin('bafkreiewws62ozsuqdylwhlj2ylu7hxauxygofmiuiezncvmjg2gofg2hq');

console.log('New Expiration Date:', renewalResult.expires_at);
```

### 3. Check Pin Retention Status (Free)

```typescript
const status = await client.getPinStatus('bafkreiewws62ozsuqdylwhlj2ylu7hxauxygofmiuiezncvmjg2gofg2hq');

console.log('Days Remaining:', status.days_remaining);
console.log('Is Active:', status.is_active);
```

---

## Dynamic Pricing & Retention Rules

- **Base Upload Fee**: `0.01 USDC` (10,000 microUSDC) + `0.000001 USDC/byte`.
- **Retention Timebox**: `365 days` per payment.
- **Early Renewal Discount**: `50% off` standard price if renewed prior to expiration date.
- **Grace Period**: `30 days` after expiration. Files unpinned after day 395.

---

## Error Handling

The SDK provides specific error classes to help autonomous agents and applications handle payment edge cases gracefully:

- `InsufficientBudgetError`: Thrown when the gateway requests a price that exceeds your configured `maxPriceUsdc` cap.
- `PaymentDeclinedError`: Thrown when a custom `confirmPrice` callback function returns `false`, rejecting the payment.

Example:
```typescript
import { InsufficientBudgetError, PaymentDeclinedError } from 'ipfs-pay-to-pin-client';

try {
  await client.pinFile({ filename: 'test.png', data: myData });
} catch (error) {
  if (error instanceof InsufficientBudgetError) {
    console.error('File too large or price cap too low:', error.message);
  } else if (error instanceof PaymentDeclinedError) {
    console.error('Payment manually declined:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## License

AGPLv3 License.
