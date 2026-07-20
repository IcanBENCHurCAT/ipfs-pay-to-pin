# Implementation Plan: AB-PP-002 (x402 Dynamic Payment Challenge & Local Verification)

**Branch**: `002-payment-challenge` | **Date**: 2026-07-20 | **Spec**: [spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/002-payment-challenge/spec.md)

**Input**: Feature specification from `/specs/002-payment-challenge/spec.md`

## Summary

This feature implements the core gating logic of the IPFS Pay-to-Pin gateway. The API receives a file upload request via `POST /api/v1/pin`, stores the file in temporary storage, calculates the price dynamically by querying the escrow smart contract state, and responds with a standard HTTP `402 Payment Required` response containing the challenge details in headers and body. Once the client has paid, they submit the on-chain transaction ID via `POST /api/v1/verify`. The system verifies the transaction parameters (receiver, amount, reference note, double-spend) on-chain, pins the file to IPFS, and returns the canonical IPFS CID.

## Technical Context

**Language/Version**: Python 3.12+

**Primary Dependencies**: FastAPI, Uvicorn, py-algorand-sdk (`algosdk`), aiohttp (or requests)

**Storage**: In-memory cache for file contents & verification statuses (mocking persistent cache/database)

**Testing**: pytest, pytest-asyncio, httpx

**Target Platform**: FastAPI Application Server (Linux/macOS/Windows)

**Project Type**: web-service

**Performance Goals**:
- Dynamic challenge generation: <200ms latency (p95)
- Local mock node verification: <200ms latency

**Constraints**:
- Exact compliance with the custom HTTP x402 headers: `X-Algorand-Address`, `X-Algorand-Amount`, and `X-Algorand-Txn-Ref`.
- Total Fee calculation formula: $\text{Fee} = \text{Base Price} + (\text{Size in Bytes} \times \text{Byte Price})$.

**Scale/Scope**: Single service backend serving pay-to-pin requests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re check after Phase 1 design.*

- [x] **Smart Contract Language**: Are all smart contracts written in Algorand Python (`algopy`) and compiled via the Puya compiler? (Yes, escrow contract in `escrow/contract.py` is written in `algopy` and compiled output is present).
- [x] **RekeyTo Protection**: Are all state-modifying contract methods protected by RekeyTo checks (`Txn.rekey_to() == Account(0)`)? (Yes, validated via unit tests in `tests/test_contract.py`).
- [x] **Owner-only Configuration**: Are base-price and per-byte pricing adjustments securely restricted to the contract owner? (Yes, verified by unit tests).
- [x] **HTTP x402 Protocol Compliance**: Does the API return standard HTTP 402 with appropriate JSON body and standard `X-Algorand-*` headers? (Yes, structured in dynamic payment challenge responses).
- [x] **IPFS Pinning Integration**: Does the pinning workflow output valid IPFS CIDs after verifying the payment on-chain? (Yes, planned under the storage provider wrapper).

## Project Structure

### Documentation (this feature)

```text
specs/002-payment-challenge/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── quickstart.md        # Phase 1 output
```

### Source Code

```text
gateway/
├── main.py             # App routing and entry points
├── config.py           # Configuration parameters and environment variables
├── payment.py          # Payment verification and on-chain querying logic
└── storage.py          # IPFS client pinning logic (mock/live client wrapper)

escrow/
├── contract.py         # Smart contract source
└── PayToPinEscrow.approval.teal  # Compiled TEAL code

tests/
├── test_contract.py    # Unit tests for contract bytecode properties
└── test_gateway.py     # Integration tests for gateway API
```

**Structure Decision**: Single project structure with `gateway/` for Python FastAPI source code, `escrow/` for contract code, and `tests/` for verification tests.

## Complexity Tracking

*No violations to track.*
