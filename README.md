# IPFS Pay-to-Pin Gateway

An HTTP API that gates file storage (pinning) on IPFS using standard x402 microUSDC micropayments on Algorand. Each payment provides 365 days of pinning retention, with a `/renew` endpoint for annual extensions.

## Core Features
- **365-Day Retention**: Each paid upload pins the file for 365 days. `expires_at` timestamp is returned in the response.
- **Annual x402 Renewals (`POST /api/v1/renew`)**: Autonomous agents can renew retention for another 365 days by settling an x402 microUSDC challenge.
- **Free Pin Status Lookup (`GET /api/v1/pin/:cid`)**: Public status endpoint returning `days_remaining`, `is_active`, and `expires_at` without requiring payment.
- **Buffer Queue & Circuit Breaker**: Asynchronously buffers files locally to decouple payment verification from storage providers. Returns `503 Service Unavailable` if the queue is full.

## API Flow
1. **Upload Request**: Client sends `POST /api/v1/pin` with `{ "filename": "data.json", "data": "<base64_string>" }`.
2. **x402 Challenge**: Server responds with `402 Payment Required` and standard `PAYMENT-REQUIRED` header.
3. **Settlement**: Client signs microUSDC payment on Algorand and resubmits request with `PAYMENT-SIGNATURE` header.
4. **Pinning**: Server verifies payment, calculates deterministic IPFS CID, buffers file locally, and pins it asynchronously.

## Technology Stack
- **API Server**: Node.js, TypeScript, Hono (`@hono/node-server`)
- **x402 Middleware**: `@x402/hono`, `@x402/avm`, `@x402/core`, `@x402/extensions`
- **Smart Contract**: Algorand Python (`algopy` via Puya)
- **Pinning Provider**: Pinata API (`https://api.pinata.cloud`)

## Local Setup
```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```

## License
MIT License