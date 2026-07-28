# AGENTS.md — Agent Guide for IPFS "Pay-to-Pin" Gateway

Welcome, agent. This document outlines the project guidelines, architecture, and coding conventions for the IPFS "Pay-to-Pin" Gateway project.

---

## 1. Project Overview

The IPFS "Pay-to-Pin" Gateway is a service that implements a standard HTTP `402 Payment Required` interface to gate file storage (pinning) on decentralized networks like IPFS using Algorand microUSDC payments.

### Core Architecture
- **API (Hono/TypeScript)**: Receives file uploads, issues x402 payment requests, verifies transactions, and pins files to IPFS. Uses the standard `@x402/hono` middleware.
- **Smart Contract (`escrow.py`)**: Written in `algopy` (Algorand Python) and compiled via Puya.
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
├── escrow/                 # Smart Contract directory
│   ├── contract.py         # algopy smart contract logic
│   └── compile.py          # Script to compile smart contract
├── src/                    # TypeScript Hono Application
│   ├── index.ts            # Entrypoint & x402 configuration
│   ├── queue.ts            # Local Buffer Queue
│   ├── cid.ts              # Deterministic CID calculation
│   └── storage.ts          # Pinata interaction & buffering logic
├── tests/                  # Test suite
├── scripts/                # Helper scripts for interaction
├── README.md               # Overview and user instructions
└── AGENTS.md               # This guide
```

---

## 3. Technology Stack & Key Libraries

- **Backend**: Node.js, TypeScript, Hono (`@hono/node-server`).
- **x402 Integration**: `@x402/hono`, `@x402/core`, `@x402/avm`, `@x402/extensions`.
- **Smart Contract compiler**: Algorand Python (`algopy` via Puya).
- **IPFS Clients**: `@pinata/sdk` or raw HTTP requests to Pinata.

---

## 4. Coding Conventions & Guardrails

- **Algorand Python Rules**: Implement contracts using pure `algopy` syntax. Ensure all application methods return valid types and manage state variables strictly inside Boxes or Global State.
- **No Hardcoded Secrets**: Access credentials (e.g., `PINATA_JWT`, `ALGORAND_WALLET_PRIVATE_KEY`) strictly from `.env`.
- **x402 Compliance**: Always use the standard `@x402/hono` middleware for generating `402 Payment Required` responses (`PAYMENT-REQUIRED` and `PAYMENT-SIGNATURE` headers).
- **Pricing & Retention**: Micropayments are calculated in **microUSDC**. Pins are timeboxed for **up to 365 days** per payment, with a `/renew` endpoint for annual recurring retention payments.
- **Fault Tolerance**: The API MUST decouple the synchronous Pinata upload from the client response. It MUST use a Circuit Breaker to reject traffic with `503 Service Unavailable` if the local buffer queue is full, preventing agents from paying for dropped storage.

---
*Keep this document updated as the project evolves.*
