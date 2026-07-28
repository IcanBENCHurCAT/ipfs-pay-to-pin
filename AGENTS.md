# AGENTS.md — Agent Guide for IPFS "Pay-to-Pin" Gateway

Welcome, agent. This document outlines the project guidelines, architecture, and coding conventions for the IPFS "Pay-to-Pin" Gateway project.

---

## 1. Project Overview

The IPFS "Pay-to-Pin" Gateway is a service that implements an HTTP `402 Payment Required` interface to gate file storage (pinning) on decentralized networks like IPFS with Algorand micropayments.

### Core Architecture
- **API (Hono + TS)**: Receives file uploads, issues x402 payment requests, verifies transactions, and pins files.
- **Smart Contract**: ASC1 written in TypeScript-compatible `typescript-algopay` and compiled with Puya (guardrails from `.specify/memory/constitution.md`).
- **Storage Layer**: Communicates with IPFS pinning services (e.g., Pinata) or optional self‑hosted Kubo node.
- **Client Flow**:
  1. Client calls `POST /api/v1/pin` with Base64‑encoded JSON payload.
  2. Server returns `402 Payment Required` listing payment terms to be settled on Algorand.
  3. Client pays on Algorand; upon verification the gateway pins the file **for up to 365 days** and returns CID + `gateway_url`.
  4. Background job checks expiration and fires a heartbeat event if renewal is needed.

---

## 2. Directory Structure

```text
ipfs-pay-to-pin/
├── .specify/               # SpecKit specs, memory & extensions
│   ├── memory/             # Project status, spec, constitution.md
│   │   └── constitution.md
│   └── extensions.yml        # optional skill hooks
├── .agents/                # Custom subagents or rules
├── src/                    # TypeScript source (`index.ts`, `storage.ts`, …)
├── escrow/                 # ASC1 contract source (`contract.ts`)
│   └── compile.ts          # Puya compilation script
├── tests/                  # Test suite
│   ├── test_contract.ts
│   └── test_gateway.ts
├── README.md               # Overview, tech‑stack, config, migration guide
└── AGENTS.md               # This guide
```

---

### Governance & Guardrails

- All new features **MUST** comply with the **Constitution** (`.specify/memory/constitution.md`).
- Any change that touches fee calculation, smart‑contract storage, or x402 endpoint contracts requires at least one **peer review** from an existing maintainer.
- The **robustness plan** (see `/specs/ipfs‑robustness‑plan.md`) is the canonical source for lifetime, multi‑gateway and monitoring requirements.
- Logging, metrics and heartbeat events **SHOULD** be emitted for all pinning actions.
- Any deprecation of the legacy Python contract must be accompanied by a TypeScript version and migration guide.

Feel free to reach out for clarification or to pitch new robustness‑related tasks.