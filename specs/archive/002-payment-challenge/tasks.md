---
description: "Task list for Payment Challenge & Verification implementation"
---

# Tasks: AB-PP-002 (x402 Dynamic Payment Challenge & Local Verification)

**Input**: Design documents from `/specs/002-payment-challenge/`

**Prerequisites**: [plan.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/002-payment-challenge/plan.md) (required), [spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/002-payment-challenge/spec.md) (required for user stories), [research.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/002-payment-challenge/research.md), [data-model.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/002-payment-challenge/data-model.md), [quickstart.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/002-payment-challenge/quickstart.md)

**Tests**: Test tasks are included as requested in the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Backend source: `gateway/`
- Smart contract source & TEAL: `escrow/`
- Testing suite: `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment and configurations setup

- [x] T001 Update environment configuration logic in `gateway/config.py` to support `ALGOD_ADDRESS`, `ALGOD_TOKEN`, `ESCROW_APP_ID`, and `ESCROW_ADDRESS`.
- [x] T002 Setup a sample `.env` file at project root defining development defaults.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core payment utilities and smart contract state querying logic

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Initialize Algod client instance in `gateway/payment.py` using settings.
- [x] T004 Implement smart contract pricing query function in `gateway/payment.py` to retrieve `base_price` and `byte_price` from `ESCROW_APP_ID` global state, including in-memory TTL caching.

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Dynamic Payment Challenge (Priority: P1) 🎯 MVP

**Goal**: Support size-based fee calculations and HTTP 402 challenge responses.

**Independent Test**: Upload file to `/api/v1/pin` and verify HTTP 402 response and standard headers.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T005 [P] [US1] Create integration tests in `tests/test_gateway.py` asserting that `/api/v1/pin` returns HTTP 402 with correct `X-Algorand-*` headers and JSON body for unverified uploads.

### Implementation for User Story 1

- [x] T006 [US1] Update `gateway/main.py` upload logic in `/api/v1/pin` to query contract rates dynamically, compute fee size, cache the file, and return the standard HTTP 402 payment challenge.

**Checkpoint**: User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Transaction Verification & Release (Priority: P1)

**Goal**: Verify transaction ID on-chain, reject double-spends and mismatches, release CID.

**Independent Test**: Verify payment with mock transaction ID and assert CID creation, check duplicate tx_id is rejected.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T007 [P] [US2] Create integration tests in `tests/test_gateway.py` verifying `/api/v1/verify` under successful verification, incorrect transaction details, and double-spend attempts.

### Implementation for User Story 2

- [x] T008 [US2] Implement `verify_transaction` in `gateway/payment.py` validating receiver, amount, confirmation round, and UTF-8 decoded note field against expected values.
- [x] T009 [US2] Implement in-memory spent transaction registry and cleanup scheduler in `gateway/main.py`.
- [x] T010 [US2] Update `/api/v1/verify` in `gateway/main.py` to trigger transaction verification, spent check, status update, mock pinning CID generation, cache clearance, and HTTP 201 response.

**Checkpoint**: Both User Stories 1 and 2 work independently and in integration.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Integration checks, manual scenario verification, and conformance check

- [x] T011 Run complete pytest test suite on `tests/test_gateway.py` and `tests/test_contract.py`.
- [x] T012 Verify Scenario A, B, and C manually using curl commands as defined in [quickstart.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/002-payment-challenge/quickstart.md).
- [x] T013 Ensure all API responses comply with `X-Algorand-*` protocol headers in [constitution.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/.specify/memory/constitution.md).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
- **Polish (Final Phase)**: Depends on all user stories being complete.
