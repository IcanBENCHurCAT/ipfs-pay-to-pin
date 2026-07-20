# Implementation Plan: AB-PP-001 (Pricing & Configuration Contract)

**Branch**: `feat/001-pricing-contract` | **Date**: 2026-07-20 | **Spec**: [AB-PP-001 (Pricing & Configuration Contract)](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/001-pricing-contract/spec.md)

**Input**: Feature specification from `/specs/001-pricing-contract/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

The system MUST provide a smart contract written in Algorand Python (`algopy`) and compiled using Puya compiler targeting AVM 12+ that securely manages base-price and per-byte pricing, so that the service fee structure is on-chain, auditable, and easily adjustable by the contract owner. It will feature owner validation and rekey protection.

## Technical Context

**Language/Version**: Python 3.12

**Primary Dependencies**: algopy (Puya compiler), pytest, py-algorand-sdk

**Storage**: N/A (On-chain state)

**Testing**: pytest

**Target Platform**: Algorand AVM 12+

**Project Type**: smart contract

**Performance Goals**: N/A

**Constraints**: N/A

**Scale/Scope**: N/A

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Smart Contract Language**: Are all smart contracts written in Algorand Python and compiled via the Puya compiler? (AVM 12+)
- [x] **RekeyTo Protection**: Are all state-modifying contract methods protected by RekeyTo checks (`Txn.rekey_to() == Account(0)`)?
- [N/A] **Box Storage Limits**: Are keys and storage sizes inside boxes strictly limited (Proof URL <= 512 bytes, Proof JSON <= 2048 bytes, Dispute Reason <= 256 bytes)?
- [N/A] **Karma Ledger Gatekeeping**: If the feature creates or claims bounties, does it integrate with the Karma Ledger and enforce karma tier rules?
- [N/A] **Escrow Funding Verification**: Does it implement dual-layer verification (transaction group validation + application balance check) for funding new escrows?
- [N/A] **Atomic Payout Group**: Are all payout, refund, or split operations structured as atomic groups (app call + contract-as-sender payment)?
- [N/A] **OIDC Security**: Are GitHub Actions automated tests validated securely using GitHub JWKS OIDC tokens?
- [N/A] **Database Compatibility**: Do database operations support both production PostgreSQL (`postgresql+asyncpg://`) and local SQLite?
- [N/A] **Continuous Worker Setup**: Does the background worker/indexer run continuously in a non-throttled GCP Cloud Run environment?
- [N/A] **Mediator Fee Safety Net**: If the feature touches payouts, fees, or claims, does it implement the safety nets (refunding the 0.25% fee to the worker under HITM or undisputed Auto modes, and only splitting/paying mediators if a dispute is mediated in Auto mode)?

## Project Structure

### Documentation (this feature)

```text
specs/001-pricing-contract/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
└── smart_contracts/
    └── pricing/
        └── contract.py

tests/
└── pricing/
    └── test_contract.py
```

**Structure Decision**: Single project layout focusing on smart contract and verification tests.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| | | |
