# Implementation Plan: Pinata IPFS Pinning Integration

**Branch**: `003-pinata-ipfs-pinning` | **Date**: 2026-07-20 | **Spec**: [specs/003-pinata-ipfs-pinning/spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/003-pinata-ipfs-pinning/spec.md)

**Input**: Feature specification from `/specs/003-pinata-ipfs-pinning/spec.md`

## Summary

This plan adds a Pinata IPFS adapter to the storage module of the IPFS Pay-to-Pin Gateway. When verification succeeds and `STORAGE_ADAPTER=pinata` is configured, files are securely forwarded to Pinata's HTTP `pinFileToIPFS` API.

## Technical Context

**Language/Version**: Python 3.12+

**Primary Dependencies**: FastAPI, `httpx` (or `aiohttp`) for async client.

**Storage**: Memory cache for challenges, Pinata remote pinning.

**Testing**: `pytest`, `pytest-asyncio`

**Target Platform**: Linux / Windows server

**Project Type**: web-service

**Performance Goals**: <5s upload to Pinata.

**Constraints**: API must not block; credentials must remain secure.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Smart Contract Language**: Are all smart contracts written in Algorand Python (`algopy`) and compiled via the Puya compiler? *(Yes, no contract changes required for this storage-adapter addition)*
- [x] **RekeyTo Protection**: Are all state-modifying contract methods protected by RekeyTo checks (`Txn.rekey_to() == Account(0)`)? *(Yes)*
- [x] **Owner-only Configuration**: Are base-price and per-byte pricing adjustments securely restricted to the contract owner? *(Yes)*
- [x] **HTTP x402 Protocol Compliance**: Does the API return standard HTTP 402 with appropriate JSON body and standard `X-Algorand-*` headers? *(Yes, existing flow maintained)*
- [x] **IPFS Pinning Integration**: Does the pinning workflow output valid IPFS CIDs after verifying the payment on-chain? *(Yes, forwarding response from Pinata API)*

## Project Structure

### Documentation (this feature)

```text
specs/003-pinata-ipfs-pinning/
├── spec.md              # Feature specification
├── plan.md              # This plan
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── quickstart.md        # Phase 1 output
```

### Source Code (repository root)

```text
gateway/
├── config.py            # Setting class modified to include Pinata details
├── main.py              # Endpoint modifications to call pinning adapter
├── payment.py           # On-chain payment verification
└── storage.py           # [NEW] Adapter interface & Pinata adapter implementation
```

**Structure Decision**: Standard FastAPI layout. We will introduce `gateway/storage.py` containing the `StorageAdapter` interface, `LocalAdapter` (matching current mock behavior), and `PinataAdapter` class.

