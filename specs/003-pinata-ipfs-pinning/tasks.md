# Tasks: Pinata IPFS Pinning Integration

**Input**: Design documents from `/specs/003-pinata-ipfs-pinning/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and environment setup

- [X] T001 [P] Add environment variable mappings for `STORAGE_ADAPTER` (default: `local`), `PINATA_JWT`, and `PINATA_ENDPOINT` in `gateway/config.py`
- [X] T002 [P] Add `httpx` to requirements dependencies (if any) or project configs
- [X] T003 [P] Add `STORAGE_ADAPTER=pinata` and `PINATA_JWT=` environment placeholders in `.env.example` and update `.env`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Setup the new Abstract StorageAdapter interface and factory

- [X] T004 Define abstract `StorageAdapter` base class and simple `LocalAdapter` implementing the interface in `gateway/storage.py`
- [X] T005 Update the application gateway initialization or settings to instantiate the correct storage adapter dynamically based on settings in `gateway/config.py` or `gateway/main.py`

---

## Phase 3: User Story 1 - Pin upload to Pinata (Priority: P1) 🎯 MVP

**Goal**: Implement the Pinata storage adapter and integrate it into the verify endpoint.

**Independent Test**: Configure `STORAGE_ADAPTER=pinata` with mock JWT and verify using test cases that the adapter attempts to call Pinata.

### Implementation for User Story 1

- [X] T006 [US1] Implement `PinataAdapter` handling multipart file upload using `httpx` in `gateway/storage.py`
- [X] T007 [US1] Update `POST /api/v1/verify` endpoint in `gateway/main.py` to invoke the configured storage adapter instead of using the hardcoded mock string.

---

## Phase 4: User Story 2 - Handle Pinata Pinning Failures (Priority: P2)

**Goal**: Handle error responses (401, 429, 5xx) from Pinata cleanly.

**Independent Test**: Run test suite asserting 502/503 errors when the storage adapter receives failure codes.

### Implementation for User Story 2

- [X] T008 [US2] Wrap API calls inside `PinataAdapter` in try-except block, raising custom exceptions mapped to gateway HTTP statuses in `gateway/storage.py`
- [X] T009 [US2] Update exception handling inside `POST /api/v1/verify` in `gateway/main.py` to catch these storage exceptions and return the appropriate JSON responses (e.g., 502/503).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Test verification and clean up.

- [X] T010 [P] Write unit tests verifying the Pinata storage adapter mock calls in `tests/test_storage_pinata.py`
- [X] T011 Update the existing tests in `tests/` to run successfully with the new architecture.
- [X] T012 Run quickstart.md validation steps.
- [X] T013 Update `README.md` to document the new `STORAGE_ADAPTER` and Pinata configuration parameters.
