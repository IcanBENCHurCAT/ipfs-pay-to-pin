# Implementation Plan: Pluggable Storage & Mock Adapter (AB-PP-003)

**Branch**: `003-pluggable-storage` | **Date**: 2026-07-20 | **Spec**: [spec.md](file:///C:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/003-pluggable-storage/spec.md)

## Summary

Implement a pluggable storage interface (`BaseStorage`) in `gateway/storage.py` and a local filesystem mock implementation (`LocalStorage`) to enable local/offline development and test suite runs without requiring active third-party cloud pinning credentials (e.g. Pinata) or encountering network latency.

## Technical Context

- **Language/Version**: Python 3.12+
- **Primary Dependencies**: FastAPI, Uvicorn, py-algorand-sdk, python-dotenv
- **Storage**: Local file system (simulating IPFS content addressing)
- **Testing**: pytest, pytest-asyncio
- **Target Platform**: Cross-platform (Windows / Linux / macOS)
- **Project Type**: Web service (FastAPI backend)
- **Performance Goals**: Mock local storage operations completed under 50ms without external HTTP calls.
- **Constraints**: Offline-capable; mock directory auto-created and validated on startup.
- **Scale/Scope**: Dev/test environment simulation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Smart Contract Language**: Are all smart contracts written in Algorand Python (`algopy`) and compiled via the Puya compiler? *(N/A for this storage feature; escrow contract is already written in algopy)*
- [x] **RekeyTo Protection**: Are all state-modifying contract methods protected by RekeyTo checks (`Txn.rekey_to() == Account(0)`)? *(N/A for this storage feature)*
- [x] **Owner-only Configuration**: Are base-price and per-byte pricing adjustments securely restricted to the contract owner? *(N/A for this storage feature)*
- [x] **HTTP x402 Protocol Compliance**: Does the API return standard HTTP 402 with appropriate JSON body and standard `X-Algorand-*` headers? *(Yes, main.py x402 endpoints are preserved and integrate with storage)*
- [x] **IPFS Pinning Integration**: Does the pinning workflow output valid IPFS CIDs after verifying the payment on-chain? *(Yes, LocalStorage generates valid CID-like content address hashes)*

## Project Structure

### Documentation (this feature)

```text
specs/003-pluggable-storage/
├── spec.md              # Requirements and scenarios
├── plan.md              # This implementation plan
├── research.md          # Architecture and design decisions
├── data-model.md        # Data models and class diagrams
└── quickstart.md        # Runnable verification guide
```

### Source Code

```text
gateway/
├── config.py            # Settings for STORAGE_PROVIDER and LOCAL_STORAGE_DIR
├── main.py              # Startup handler and API routes integration
├── payment.py           # Algorand verification logic
└── storage.py           # BaseStorage interface and LocalStorage adapter
```

**Structure Decision**: Single project layout with storage integration inside the existing FastAPI app structure.

## Complexity Tracking

No violations.
