---
description: "Task list for Pluggable Storage & Mock Adapter implementation"
---

# Tasks: AB-PP-003 (Pluggable Storage & Mock Adapter)

**Input**: Design documents from `/specs/003-pluggable-storage/`

**Prerequisites**: [plan.md](file:///C:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/003-pluggable-storage/plan.md) (required), [spec.md](file:///C:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/003-pluggable-storage/spec.md) (required for user stories), [research.md](file:///C:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/003-pluggable-storage/research.md), [data-model.md](file:///C:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/003-pluggable-storage/data-model.md), [quickstart.md](file:///C:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/003-pluggable-storage/quickstart.md)

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

**Purpose**: Environment variables and paths config setup

- [x] T001 Update environment configuration parameters in `gateway/config.py` to support `STORAGE_PROVIDER` (default "local") and `LOCAL_STORAGE_DIR` (default "tmp/mock_storage").
- [x] T002 Update local `.env` and `.env` template/example at project root to define default storage provider values.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: BaseStorage abstract class definition

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement the abstract class `BaseStorage` in `gateway/storage.py` defining the abstract methods: `store_file(self, content: bytes, filename: str) -> str` and `file_exists(self, identifier: str) -> bool`.

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Abstract Storage Interface (Priority: P1) 🎯 MVP

**Goal**: Support switching active storage providers dynamically via config.

**Independent Test**: Assert dynamic storage factory returns correct subclass according to config setting.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T004 [P] [US1] Create unit tests in `tests/test_gateway.py` verifying that the dynamic storage selection factory returns the correct storage provider instance based on settings.

### Implementation for User Story 1

- [x] T005 [US1] Implement dynamic storage provider factory or configuration selection helper in `gateway/storage.py` that instantiates the active class.

**Checkpoint**: User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Mock Local Storage Adapter (Priority: P1)

**Goal**: Implement `LocalStorage` adapter and integrate it into `/api/v1/verify` workflow.

**Independent Test**: Complete verified file upload and assert it is written in local mock storage directory.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [P] [US2] Create integration tests in `tests/test_gateway.py` verifying that `/api/v1/verify` successfully writes the payload file to the configured mock storage path and returns the correct CID.

### Implementation for User Story 2

- [x] T007 [US2] Implement `LocalStorage` in `gateway/storage.py` subclassing `BaseStorage` that writes payloads locally to `LOCAL_STORAGE_DIR` and returns a content-addressed identifier (mock CID).
- [x] T008 [US2] Initialize the storage provider in `gateway/main.py` on startup and call its `store_file` method within `/api/v1/verify` upon successful verification.

**Checkpoint**: Both User Stories 1 and 2 work independently and in integration.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Verification runs and guidelines check

- [x] T009 Run complete pytest test suite on `tests/test_gateway.py` and `tests/test_contract.py`.
- [x] T010 Manually verify Quickstart Scenario A and B from [quickstart.md](file:///C:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/003-pluggable-storage/quickstart.md) and verify files are correctly written under `tmp/mock_storage/`.
- [x] T011 Verify mock CIDs and routing logic comply with [constitution.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/.specify/memory/constitution.md).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
- **Polish (Final Phase)**: Depends on all user stories being complete.
