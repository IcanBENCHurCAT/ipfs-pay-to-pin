# Implementation Plan: Production Chain Verification Indexer

**Branch**: `004-chain-verification` | **Date**: 2026-07-20 | **Spec**: [004-chain-verification/spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/004-chain-verification/spec.md)

**Input**: Feature specification from `/specs/004-chain-verification/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Implement a production-grade transaction verification indexer that queries live testnet/mainnet node providers via `algokit-utils`. It will verify transaction amounts, receiver addresses, and references in notes, while handling block latency through retry mechanisms and preventing double-spend attacks by maintaining a registry of processed transactions.

## Technical Context

**Language/Version**: Python 3.12+

**Primary Dependencies**: FastAPI, Uvicorn, py-algorand-sdk, algokit-utils

**Storage**: SQLite database for persistent tracking of processed transaction IDs to prevent double spends (FR-005).

**Testing**: pytest, pytest-asyncio (with mock pinning and local network setup per constitution).

**Target Platform**: Linux server backend

**Project Type**: Web Service (FastAPI)

**Performance Goals**: Verify successfully within 10 seconds of block finality, handle at least 50 concurrent verification requests.

**Constraints**: Must securely reject double-spends and verify `Txn.rekey_to()` remains unmodified in contracts. Wait for block confirmation before rejecting.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Smart Contract Language**: Are all smart contracts written in Algorand Python (`algopy`) and compiled via the Puya compiler? (Yes)
- [x] **RekeyTo Protection**: Are all state-modifying contract methods protected by RekeyTo checks (`Txn.rekey_to() == Account(0)`)? (Yes)
- [x] **Owner-only Configuration**: Are base-price and per-byte pricing adjustments securely restricted to the contract owner? (Yes)
- [x] **HTTP x402 Protocol Compliance**: Does the API return standard HTTP 402 with appropriate JSON body and standard `X-Algorand-*` headers? (Yes)
- [x] **IPFS Pinning Integration**: Does the pinning workflow output valid IPFS CIDs after verifying the payment on-chain? (Yes)

## Project Structure

### Documentation (this feature)

```text
specs/004-chain-verification/
├── plan.md              
├── research.md          
├── data-model.md        
├── quickstart.md        
├── contracts/           
└── tasks.md             
```

### Source Code (repository root)

```text
gateway/
├── main.py             # Entrypoint
├── config.py           # Configuration (ports, IPFS endpoints, DB)
├── storage.py          # IPFS client
├── payment.py          # Algorand payment verification logic and polling
└── database.py         # SQLite connection and Transaction Record models

tests/
├── test_contract.py    
└── test_gateway.py     # Integration tests with mock Algorand node/pinning
```

**Structure Decision**: A single web service project structure under `gateway/`, building on the existing layout defined in `AGENTS.md`. We introduce `database.py` to handle the registry of processed transaction IDs to meet FR-005.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*(No violations)*
