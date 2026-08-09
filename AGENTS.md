# AGENTS.md — Agent Guide for IPFS "Pay-to-Pin" Gateway

Welcome, agent. This document outlines the project guidelines, architecture, and coding conventions for the IPFS "Pay-to-Pin" Gateway project.

---

## 1. Project Overview

The IPFS "Pay-to-Pin" Gateway is a service that implements a standard HTTP `402 Payment Required` interface to gate file storage (pinning) on decentralized networks like IPFS using Algorand microUSDC payments.

### Core Architecture
- **API (Hono/TypeScript)**: Receives file uploads, issues x402 payment requests, verifies microUSDC transactions, and pins files to IPFS. Uses the standard `@x402/hono` middleware.
- **Settlement Layer**: Direct microUSDC settlement to configured `ESCROW_ADDRESS` via Algorand Mainnet (`31566704`) / Testnet (`10458941`).
- **Storage Layer**: Communicates with Pinata (with optional self-hosted Kubo node/GCS fallback). Implements a Local Buffer Queue and Circuit Breaker to ensure agents do not pay for failed storage requests.
- **Client Flow**:
  1. Client calls `POST /api/v1/pin` with a JSON payload containing the Base64 file.
  2. Server returns `402 Payment Required` with a `PAYMENT-REQUIRED` header containing the x402 challenge (microUSDC pricing).
  3. Client pays on-chain and resubmits the exact original POST request with the `PAYMENT-SIGNATURE` header.
  4. Server verifies the transaction signature, buffers the file locally (returning `201 Created` immediately with a 365-day pin expiration date), and asynchronously pins it to Pinata.

---

## 2. Directory Structure

```text
ipfs-pay-to-pin/
├── .specify/               # SpecKit Specifications & Memory
│   ├── memory/             # Project status, specs, constitution.md
│   │   └── constitution.md
│   ├── templates/          # Templates for specs, plans, tasks
│   ├── extensions.yml      # Optional skill hooks
│   └── feature.json        # Current active feature reference
├── .agents/                # Custom subagents or rules
├── src/                    # TypeScript Hono Application
│   ├── index.ts            # Entrypoint & x402 configuration
│   ├── queue.ts            # Local Buffer Queue
│   ├── cid.ts              # Deterministic CID calculation
│   ├── db.ts               # Supabase persistence layer with local fallback
│   └── storage.ts          # Pinata interaction & buffering logic
├── tests/                  # Test suite
├── scripts/                # Helper scripts for interaction
├── terraform/              # 1-Click OCI Always-Free Infrastructure
├── README.md               # Overview and user instructions
└── AGENTS.md               # This guide
```

---

## 3. Technology Stack & Key Libraries

- **Backend**: Node.js, TypeScript, Hono (`@hono/node-server`).
- **x402 Integration**: `@x402/hono`, `@x402/core`, `@x402/avm`, `@x402/extensions`.
- **Database**: Supabase PostgreSQL (`@supabase/supabase-js`) with local `queue/registry.json` fallback.
- **Smart Contract compiler**: Algorand Python (`algopy` via Puya).
- **IPFS Clients**: Raw HTTP requests to Pinata REST API.

---

## 4. Coding Conventions & Guardrails

- **Algorand Python Rules**: Implement contracts using pure `algopy` syntax. Ensure all application methods return valid types and manage state variables strictly inside Boxes or Global State.
- **No Hardcoded Secrets**: Access credentials (e.g., `PINATA_JWT`, `SUPABASE_KEY`, `ALGORAND_WALLET_PRIVATE_KEY`) strictly from `.env`.
- **x402 Compliance**: Always use the standard `@x402/hono` middleware for generating `402 Payment Required` responses (`PAYMENT-REQUIRED` and `PAYMENT-SIGNATURE` headers).
- **Pricing & Retention**: Micropayments are calculated in **microUSDC**. Pins are timeboxed for **up to 365 days** per payment, with a `/renew` endpoint for annual recurring retention payments (50% early renewal discount prior to expiration).
- **Fault Tolerance**: The API MUST decouple the synchronous Pinata upload from the client response. It MUST use a Circuit Breaker to reject traffic with `503 Service Unavailable` if the local buffer queue is full, preventing agents from paying for dropped storage.

---

## 5. Deployment Procedures & CI/CD

### Environment Setup & Infrastructure
- **Hosting Platform**: Heroku (Node.js runtime executing `npm start` via `Procfile`).
- **Database & State Persistence**: Supabase PostgreSQL (`SUPABASE_URL` and `SUPABASE_KEY`). Ensures pin records, retention metadata, and renewal histories survive dyno restarts and ephemeral filesystem resets. Local file registry (`queue/registry.json`) is maintained as a zero-dependency fallback for offline dev/testing.
- **Upstream Storage**: Pinata API (`PINATA_JWT`).

### Branch Deployment Strategy
- **`main` Branch (Auto-Deploy Testnet)**: Pushing or merging code into `main` triggers automatic deployment to the Heroku Testnet staging environment. Environment configured with `ALGORAND_NETWORK=testnet`.
- **Production Mainnet**: Configured with `ALGORAND_NETWORK=mainnet` and mainnet USDC asset parameters (`31566704`).

### Required Environment Variables
| Variable | Description |
|---|---|
| `PORT` | Listening port for Hono server (default `4021`, injected by Heroku) |
| `ALGORAND_NETWORK` | `mainnet` or `testnet` |
| `ALGORAND_SERVER` | Algod node API endpoint (e.g. `https://mainnet-api.algonode.cloud`) |
| `ESCROW_ADDRESS` | Algorand wallet address for microUSDC payment settlement |
| `PINATA_JWT` | Pinata API bearer token for IPFS pinning |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon or service-role API key |

---
*Keep this document updated as the project evolves.*
