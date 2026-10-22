# IPFS Pay-to-Pin Gateway

An HTTP API that gates file storage (pinning) on IPFS using standard x402 microUSDC micropayments across **Base L2, Solana Mainnet, Algorand Mainnet, and Ethereum L1**. Each payment provides 365 days of pinning retention, with a `/renew` endpoint for annual extensions.

## Core Features
- **365-Day Retention**: Each paid upload pins the file for 365 days. `expires_at` timestamp is returned in the response.
- **Multi-Chain x402 Micropayments**: Accept microUSDC natively on **Base L2 (`eip155:8453`)**, **Solana (`solana:5eykt4...`)**, **Algorand (`algorand:mainnet`)**, and **Ethereum L1 (`eip155:1`)**.
- **Gasless EVM Permits (EIP-3009)**: Base L2 and Arbitrum payments execute via off-chain signed `transferWithAuthorization` permits, requiring $0.00 native ETH from clients.
- **Annual x402 Renewals (`POST /api/v1/renew`)**: Autonomous agents can renew retention for another 365 days by settling an x402 microUSDC challenge (50% early renewal discount applies prior to expiration).
- **Free Pin Status Lookup (`GET /api/v1/pin/:cid`)**: Public status endpoint returning `days_remaining`, `is_active`, and `expires_at` without requiring payment.
- **Buffer Queue & Circuit Breaker**: Asynchronously buffers files locally to decouple payment verification from storage providers. Returns `503 Service Unavailable` if the queue is full.

## ⚡ 1-Line Client SDK (`ipfs-pay-to-pin-client`)

Autonomous AI agents and applications can pin files to IPFS in **1 line of code** with an attached Algorand, EVM (Base L2), or Solana microUSDC wallet:

```typescript
import { IpfsPayToPinClient } from 'ipfs-pay-to-pin-client';

const client = new IpfsPayToPinClient({
  gatewayUrl: 'https://pay-to-pin.duckdns.org',
  mnemonic: process.env.ALGORAND_WALLET_MNEMONIC!,
  maxPriceUsdc: 0.05 // Budget safety cap
});

// 1-Line Pinning Call:
const pin = await client.pinFile({
  filename: 'document.png',
  data: fileBuffer
});

console.log(`Pinned CID: ${pin.cid}`);
console.log(`Gateway URL: ${pin.gateway_url}`);
console.log(`Expires At: ${pin.expires_at}`); // 365 days retention
```

## API Flow
1. **Upload Request**: Client sends `POST /api/v1/pin` with `{ "filename": "data.json", "data": "<base64_string>" }`.
2. **x402 Multi-Chain Challenge**: Server responds with `402 Payment Required` and `PAYMENT-REQUIRED` header containing CAIP-2 payment options (Base L2, Solana, Algorand, Ethereum L1).
3. **Settlement**: Client signs microUSDC payment or EIP-3009 permit and resubmits request with `PAYMENT-SIGNATURE` header.
4. **Pinning**: Server verifies payment, calculates deterministic IPFS CID, buffers file locally, and pins it asynchronously.

## Technology Stack
- **API Server**: Node.js, TypeScript, Hono (`@hono/node-server`)
- **x402 Middleware**: `@x402/hono`, `@x402/evm`, `@x402/svm`, `@x402/avm`, `@x402/core`, `@x402/extensions`
- **Multi-Chain Facilitator**: GoPlausible Facilitator (`https://facilitator.goplausible.xyz`)
- **Pinning Provider**: Pinata API (`https://api.pinata.cloud`)

## Local Setup & Development
```bash
# Install dependencies
pnpm install

# Run dev server
pnpm run dev

# Run unit and integration tests
pnpm test
pnpm run -r --include-workspace-root test

# Run Python SDK unit tests
cd python-sdk && pip install -e ".[dev]" && python3 -m pytest
```

## Production Deployment (Unified Always-Free VM)

IPFS Pay-to-Pin is deployed to a persistent **Oracle Cloud Infrastructure (OCI) Always-Free VM** (`VM.Standard.E2.1.Micro`) at `<DEPLOY_HOST_IP>`, co-located with InkPanel in `/opt/services`:

- **Unified Ingress**: A single shared Caddy 2 reverse proxy terminates TLS on ports 80/443 and routes traffic by Host header (`pay-to-pin.duckdns.org` -> `gateway:4021`).
- **Direct DNS**: DNS A records map directly to the static host IP `<DEPLOY_HOST_IP>` (no background DuckDNS updater container needed).
- **Volume Persistence**: Upload queue buffers and registry state persist across container restarts via the `gateway_queue` Docker volume (`/app/queue`).
- **Resource Boundaries**: Enforced 160M memory limit protects host RAM.
- **CI/CD Pipeline**: GitHub Actions (`.github/workflows/deploy.yml`) builds multi-arch images (`linux/amd64`, `linux/arm64`) and pushes to `ghcr.io/icanbenchurcat/pay-to-pin-gateway`. The on-host Watchtower daemon detects image updates every 120s and rolls the container with automatic layer cleanup.


## License

MIT License

This project is licensed under the MIT License. You are free to use, copy, modify, and distribute this code, including for commercial purposes, with no obligation to open-source your own work. See [LICENSE](LICENSE) for the full text.
