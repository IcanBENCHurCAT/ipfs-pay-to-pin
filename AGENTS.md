# AGENTS.md — Agent Guide for IPFS "Pay-to-Pin" Gateway

Welcome, agent. This document outlines the project guidelines, architecture, and coding conventions for the IPFS "Pay-to-Pin" Gateway project.

---

## 1. Project Overview

The IPFS "Pay-to-Pin" Gateway is a service that implements an HTTP `402 Payment Required` interface to gate file storage (pinning) on decentralized networks like IPFS with Algorand micropayments.

### Core Architecture
- **API (FastAPI)**: Receives file uploads, issues x402 payment requests, verifies transactions, and pins files.
- **Smart Contract (`escrow.py`)**: Written in `algopy` (Algorand Python). Manages platform settings (price per byte, registry of active gateway operators, treasury address).
- **Storage Layer**: Communicates with IPFS pinning services (e.g., Pinata) or local IPFS daemons.
- **Client Flow**:
  1. Client calls `POST /api/v1/pin` with payload.
  2. Server returns `402 Payment Required` JSON payload outlining payment amount (in microALGOs) and target escrow address.
  3. Client pays on-chain and submits txn ID to `POST /api/v1/verify` or in headers.
  4. Server verifies the transaction, finishes pinning the file, and returns the IPFS CID.

---

## 2. Directory Structure

```text
ipfs-pay-to-pin/
├── .specify/               # SpecKit Specifications & Memory
│   ├── memory/             # Project status, specs, constitution
│   │   └── constitution.md
│   └── templates/          # Templates for specs, plans, tasks
├── .agents/                # Custom subagents or rules
├── escrow/                 # Smart Contract directory
│   ├── contract.py         # algopy smart contract logic
│   └── compile.py          # Script to compile smart contract
├── gateway/                # FastAPI Application
│   ├── main.py             # Entrypoint
│   ├── config.py           # Configuration (ports, IPFS endpoints)
│   ├── storage.py          # IPFS client wrapping Pinata/Local
│   └── payment.py          # Algorand payment verification logic
├── tests/                  # Test suite
│   ├── test_contract.py    # Unit tests for contract
│   └── test_gateway.py     # Integration tests for gateway API
├── README.md               # Overview and user instructions
└── AGENTS.md               # This guide
```

---

## 3. Technology Stack & Key Libraries

- **Backend**: Python 3.12+, FastAPI, Uvicorn.
- **Algorand Integration**: `py-algorand-sdk`, `algokit-utils` (localnet / helper scripts).
- **Smart Contract compiler**: Algorand Python (`algopy` via Puya).
- **IPFS Clients**: `aiohttp` (or `requests`) calling Pinata API or local HTTP IPFS daemon.
- **Testing**: `pytest`, `pytest-asyncio`.

---

## 4. Coding Conventions & Guardrails

- **Algorand Python Rules**: Implement contracts using pure `algopy` syntax. Ensure all application methods return valid types and manage state variables strictly inside Boxes or Global State.
- **No Hardcoded Secrets**: Access credentials (e.g., `PINATA_JWT`, `ALGORAND_WALLET_PRIVATE_KEY`) strictly from `.env` via configuration classes.
- **x402 Compliance**: Always return the standard HTTP 402 header structure:
  - Header: `X-Algorand-Address`: Escrow address to receive payment.
  - Header: `X-Algorand-Amount`: Payment size in microALGOs.
  - Header: `X-Algorand-Txn-Ref`: A unique reference string/hash representing the payment challenge.
- **Deterministic Pricing**: Micropayments must be calculated dynamically:
  $$\text{Fee} = \text{Base Price} + (\text{Size in Bytes} \times \text{Byte Price})$$
  Both `Base Price` and `Byte Price` should be queried from the smart contract's global state or cache.

---
*Keep this document updated as the project evolves.*
