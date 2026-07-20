---
description: "Task list for Pricing & Configuration Contract implementation"
---

# Tasks: AB-PP-001 (Pricing & Configuration Contract)

**Input**: Design documents from `/specs/001-pricing-contract/`

**Prerequisites**: [plan.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/001-pricing-contract/plan.md) (required), [spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/001-pricing-contract/spec.md) (required for user stories), [research.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/001-pricing-contract/research.md), [data-model.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/001-pricing-contract/data-model.md), [quickstart.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/001-pricing-contract/quickstart.md)

**Tests**: Test tasks are included as requested in the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Using standard directory paths: `escrow/` for contract, `tests/` for tests as defined in [AGENTS.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/AGENTS.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize the test suite directory at `tests/` and setup basic pytest configuration
- [x] T002 Configure Algorand Python compilation requirements and tools (e.g., ensure `algokit` / `puya` is available)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core smart contract infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Ensure baseline `PayToPinEscrow` class contract exists in `escrow/contract.py` with `__init__` defining `owner`, `base_price`, and `byte_price` state.

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Configure Pricing Variables (Priority: P1) 🎯 MVP

**Goal**: Allow the contract owner to securely get and update `base_price` and `byte_price` variables.

**Independent Test**: Simulate owner updating pricing variables successfully, and unauthorized accounts failing.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T004 [P] [US1] Create unit tests in `tests/test_contract.py` to verify owner-only updates to `base_price` and `byte_price`.
- [x] T005 [P] [US1] Create unit tests in `tests/test_contract.py` to verify that non-owner update calls are rejected with "Only owner can update pricing".

### Implementation for User Story 1

- [x] T006 [US1] Implement `update_pricing` method in `escrow/contract.py` validating that `Txn.sender == self.owner`.
- [x] T007 [US1] Implement state variable persistence in global state for `base_price` and `byte_price` in `escrow/contract.py`.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Prevent Account Takeover (Priority: P1)

**Goal**: Verify that all critical state-modifying contract methods check that the account's rekey status remains unmodified.

**Independent Test**: Simulate transaction attempting to set `rekey_to` and verify it is rejected.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US2] Create unit tests in `tests/test_contract.py` that trigger `update_pricing` or `withdraw_fees` with a non-zero `rekey_to` address and expect transaction rejection.

### Implementation for User Story 2

- [x] T009 [US2] Add assertions to `update_pricing` and `withdraw_fees` in `escrow/contract.py` to verify `Txn.rekey_to == Account(0)` (or equivalent algopy construct).

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T010 Compile the escrow contract using `algokit compile py escrow/contract.py` and verify generated TEAL artifact outputs.
- [x] T011 Run complete pytest test suite on `tests/test_contract.py` to verify all test cases pass.
- [x] T012 Verify smart contract complies with all constraints in [constitution.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/.specify/memory/constitution.md).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
- **Polish (Final Phase)**: Depends on all user stories being complete.
