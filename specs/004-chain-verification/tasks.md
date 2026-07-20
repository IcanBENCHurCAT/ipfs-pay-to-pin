---
description: "Task list for Chain Verification Indexer implementation"
---

# Tasks: Production Chain Verification Indexer

**Input**: Design documents from `/specs/004-chain-verification/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Update environment variables for SQLite configuration and Algorand nodes in `gateway/config.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Create database configuration and connection setup using SQLite in `gateway/database.py`
- [x] T003 Update FastAPI lifespan/startup event to initialize database schema in `gateway/main.py`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Secure Payment Verification (Priority: P1) 🎯 MVP

**Goal**: Reliably query live blockchain nodes to verify payments so that attackers cannot bypass payment requirements using fake or double-spent transactions.

**Independent Test**: Can be fully tested by submitting a valid transaction ID from the network and confirming it is recognized, as well as submitting a re-used or spoofed transaction and confirming it is rejected.

### Implementation for User Story 1

- [x] T004 [P] [US1] Create Transaction Record and Verification Challenge models in `gateway/database.py`
- [x] T005 [P] [US1] Implement Algorand node provider connection initialization in `gateway/payment.py`
- [x] T006 [US1] Implement payment verification and double-spend check logic querying `algokit-utils` in `gateway/payment.py`
- [x] T007 [US1] Implement `POST /api/v1/verify` endpoint integrating verification and pinning in `gateway/main.py`
- [x] T008 [P] [US1] Write contract test for POST /api/v1/verify success and double-spend rejection in `tests/test_gateway.py`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Handling Block Latency (Priority: P2)

**Goal**: Gracefully handle network delays and block latency so that legitimate user payments are not prematurely rejected before they are confirmed on-chain.

**Independent Test**: Can be tested by submitting a transaction and immediately requesting verification, ensuring the system waits appropriately for block confirmation rather than instantly failing.

### Implementation for User Story 2

- [x] T009 [P] [US2] Update node provider logic to support fallback nodes for high availability in `gateway/payment.py`
- [x] T010 [US2] Implement exponential backoff and retry polling mechanism for transaction fetching in `gateway/payment.py`
- [x] T011 [US2] Integrate retry logic into the payment verification flow in `gateway/payment.py`
- [x] T012 [P] [US2] Write integration test for block latency handling and retries in `tests/test_gateway.py`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T013 [P] Document environment variables and database structure in `README.md`
- [x] T014 [P] Code cleanup and refactoring for Algorand queries in `gateway/payment.py`
- [x] T015 Run validation scenarios from `specs/004-chain-verification/quickstart.md`


---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 logic

### Parallel Opportunities

- Foundation tasks marked [P] can run in parallel (within Phase 2)
- Models within a story marked [P] can run in parallel
- Tests for a user story marked [P] can run in parallel with implementation

---

## Parallel Example: User Story 1

```bash
# Launch models and node connection setup together:
Task: "Create Transaction Record and Verification Challenge models in gateway/database.py"
Task: "Implement Algorand node provider connection initialization in gateway/payment.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready
