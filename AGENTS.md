# AGENTS.md — Agent Guide for IPFS "Pay-to-Pin" Gateway

Welcome, agent. This document outlines the project guidelines, architecture, and coding conventions for the IPFS "Pay-to-Pin" Gateway project.

---

## 1. Project Overview

The IPFS "Pay-to-Pin" Gateway is a service that implements a standard HTTP `402 Payment Required` interface to gate file storage (pinning) on decentralized networks like IPFS using Algorand microUSDC payments.

### Core Architecture
- **API (Hono/TypeScript)**: Receives file uploads, issues x402 payment requests, verifies multi-chain microUSDC transactions (Base L2, Solana, Algorand, Ethereum L1), and pins files to IPFS. Uses standard `@x402/hono` middleware.
- **Settlement Layer**: Direct microUSDC settlement or EIP-3009 permit relaying to `ESCROW_ADDRESS`, `EVM_ESCROW_ADDRESS`, or `SOLANA_ESCROW_ADDRESS` via GoPlausible Facilitator (`https://facilitator.goplausible.xyz`).
- **Storage Layer**: Communicates with Pinata (with optional self-hosted Kubo node/GCS fallback). Implements a Local Buffer Queue and Circuit Breaker to ensure agents do not pay for failed storage requests.
- **Client Flow**:
  1. Client calls `POST /api/v1/pin` with a JSON payload containing the Base64 file.
  2. Server returns `402 Payment Required` with a `PAYMENT-REQUIRED` header containing the x402 multi-chain challenge (CAIP-2 networks: `eip155:8453`, `solana:5ey...`, `algorand:mainnet`).
  3. Client pays on-chain or signs EIP-3009 gasless authorization and resubmits request with `PAYMENT-SIGNATURE` header.
  4. Server verifies transaction/signature proof, buffers file locally (returning `201 Created` immediately with a 365-day pin expiration date), and asynchronously pins it to Pinata.

---

## 2. Directory Structure

```text
ipfs-pay-to-pin/
├── src/                    # TypeScript Hono Application Gateway
│   ├── index.ts            # Entrypoint & multi-chain x402 configuration
│   ├── queue.ts            # Local Buffer Queue & worker logic
│   ├── cid.ts              # Deterministic CID calculation
│   ├── db.ts               # Supabase persistence layer with local fallback
│   ├── storage.ts          # Pinata interaction & buffering logic
│   ├── refund.ts           # On-chain payment refund module
│   └── config.ts           # Environment & runtime configuration
├── sdk/                    # TypeScript Client SDK (`ipfs-pay-to-pin-client`)
├── python-sdk/             # Python Client SDK (`ipfs-pay-to-pin-client`)
├── tests/                  # Gateway root unit & integration tests
├── scripts/                # Helper deployment, verification, and sweeper scripts
├── terraform/              # OCI Infrastructure & Monitoring
├── specs/                  # Specification documents
├── README.md               # Repository overview and quickstart
└── AGENTS.md               # Agent guide and guidelines
```

---

## 3. Technology Stack & Key Libraries

- **Backend Gateway**: Node.js, TypeScript, Hono (`@hono/node-server`).
- **x402 Integration**: `@x402/hono`, `@x402/core`, `@x402/evm`, `@x402/svm`, `@x402/avm`, `@x402/extensions`.
- **Facilitator**: GoPlausible Facilitator (`https://facilitator.goplausible.xyz`).
- **Database**: Supabase PostgreSQL (`@supabase/supabase-js`) with local `queue/registry.json` fallback.
- **IPFS Pinning**: Pinata REST API.
- **Client SDKs**: TypeScript (`sdk/`) and Python (`python-sdk/`).

---

## 4. Coding Conventions & Guardrails

- **Package Manager**: Use `pnpm` exclusively for Node workspace tasks (`pnpm install`, `pnpm test`, `pnpm run -r test`, `pnpm run -r build`).
- **Python Testing**: Use `python3 -m pytest python-sdk/tests` for Python SDK testing.
- **No Hardcoded Secrets**: Access credentials (e.g., `PINATA_JWT`, `SUPABASE_KEY`, `ALGORAND_WALLET_PRIVATE_KEY`) strictly from `.env` or environment variables.
- **x402 Compliance**: Always use standard `@x402/hono` middleware for generating `402 Payment Required` responses (`PAYMENT-REQUIRED` and `PAYMENT-SIGNATURE` headers).
- **Pricing & Retention**: Micropayments are calculated in **microUSDC**. Pins are timeboxed for **up to 365 days** per payment, with a `/renew` endpoint for annual recurring retention payments (50% early renewal discount prior to expiration).
- **Fault Tolerance**: The API MUST decouple the synchronous Pinata upload from the client response. It MUST use a Circuit Breaker to reject traffic with `503 Service Unavailable` if the local buffer queue is full, preventing agents from paying for dropped storage.

---

## 5. Deployment Procedures & CI/CD

### Environment Setup & Infrastructure
- **Hosting Platform**: Oracle Cloud Infrastructure (OCI Always-Free VPS via 1-Click Terraform) or Heroku (Node.js runtime executing `npm start`).
- **Database & State Persistence**: Supabase PostgreSQL (`SUPABASE_URL` and `SUPABASE_KEY`). Ensures pin records, retention metadata, and renewal histories survive dyno restarts and ephemeral filesystem resets. Local file registry (`queue/registry.json`) is maintained as a zero-dependency fallback for offline dev/testing.
- **Upstream Storage**: Pinata API (`PINATA_JWT`).

### Branch Deployment Strategy
- **`main` Branch (Auto-Deploy Testnet/Staging)**: Pushing or merging code into `main` triggers automatic deployment.
- **Production Mainnet**: Configured with `ALGORAND_NETWORK=mainnet` and mainnet USDC parameters across chains.

### Required Environment Variables
| Variable | Description |
|---|---|
| `PORT` | Listening port for Hono server (default `4021`) |
| `ALGORAND_NETWORK` | `mainnet` or `testnet` |
| `ESCROW_ADDRESS` | Algorand wallet address for microUSDC payment settlement |
| `EVM_ESCROW_ADDRESS` | Base L2 / EVM wallet address for microUSDC payment settlement |
| `SOLANA_ESCROW_ADDRESS` | Solana wallet address for SPL USDC payment settlement |
| `FACILITATOR_URL` | GoPlausible Facilitator URL (`https://facilitator.goplausible.xyz`) |
| `PINATA_JWT` | Pinata API bearer token for IPFS pinning |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon or service-role API key |

---
*Keep this document updated as the project evolves.*
