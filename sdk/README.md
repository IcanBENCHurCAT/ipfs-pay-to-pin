# `ipfs-pay-to-pin-client`

TypeScript client library for pinning files to IPFS via the **IPFS Pay-to-Pin Gateway** using standard **x402 HTTP micropayments** across **Base L2, Solana, Algorand, and Ethereum L1**.

- **Merchant Dashboard**: [GoPlausible Merchant Catalog](https://facilitator.goplausible.xyz/dashboard/merchants/c4f55ee4a1a2ae08)
- **Live Gateway API**: `https://pay-to-pin.duckdns.org`
- **Protocol Standard**: HTTP `402 Payment Required` via `@x402/core`, `@x402/evm`, `@x402/svm`, & `@x402/avm`

---

## Overview

The IPFS Pay-to-Pin Gateway eliminates the need to sign up for monthly SaaS subscriptions or manage Pinata API keys when uploading files to IPFS.

With an EVM private key (Base L2), Solana Keypair, or Algorand wallet containing microUSDC, any script or agent can upload a file, receive an HTTP `402 Payment Required` challenge, sign the microUSDC payment or gasless authorization, and receive an instant 365-day IPFS pin confirmation.

---

## Installation

```bash
pnpm add ipfs-pay-to-pin-client @x402/core @x402/evm @x402/svm @x402/avm
```

---

## Quickstart

### 1. Multi-Chain Initialization Options

```typescript
import { IpfsPayToPinClient } from 'ipfs-pay-to-pin-client';

// Option A: Base L2 / EVM Wallet (Gasless EIP-3009 transfer authorization)
const baseClient = new IpfsPayToPinClient({
  evmPrivateKey: '0xYourBaseEvmPrivateKey...',
  maxPriceUsdc: 0.10 // budget cap safety limit in USDC
});

// Option B: Solana Mainnet Wallet
const solanaClient = new IpfsPayToPinClient({
  solanaPrivateKey: 'YourSolanaBase58PrivateKey...',
  maxPriceUsdc: 0.10
});

// Option C: Algorand Mainnet Wallet
const algoClient = new IpfsPayToPinClient({
  mnemonic: 'your 25 word algorand wallet mnemonic here...',
  network: 'mainnet'
});
```

### 2. Upload & Pin a File (1-Line Call)

```typescript
const fileBuffer = Buffer.from('Hello Multi-Chain Pay-to-Pin!');

const result = await baseClient.pinFile({
  filename: 'hello.txt',
  data: fileBuffer
});

console.log('Pinned CID:', result.cid);
console.log('Gateway URL:', result.gateway_url);
console.log('Expires At:', result.expires_at);
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
- `ConfigurationError`: Thrown when the SDK is misconfigured (e.g. missing required private keys or mnemonics, or invalid inputs to client methods).
- `GatewayError`: Thrown when the IPFS Pay-to-Pin gateway returns an HTTP error (e.g. 503 Service Unavailable if the queue is full, 404 if the pin is not found, or 400 Bad Request). Contains an optional `status` property for the HTTP status code.

Example:
```typescript
import { InsufficientBudgetError, PaymentDeclinedError, ConfigurationError, GatewayError } from 'ipfs-pay-to-pin-client';

try {
  await client.pinFile({ filename: 'test.png', data: myData });
} catch (error) {
  if (error instanceof InsufficientBudgetError) {
    console.error('File too large or price cap too low:', error.message);
  } else if (error instanceof PaymentDeclinedError) {
    console.error('Payment manually declined:', error.message);
  } else if (error instanceof ConfigurationError) {
    console.error('Client misconfigured:', error.message);
  } else if (error instanceof GatewayError) {
    console.error(`Gateway error (${error.status || 'Network'}):`, error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## License

AGPLv3 License.
