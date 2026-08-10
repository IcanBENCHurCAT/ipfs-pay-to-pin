# Tasks: 009-python-pypi-sdk

**Input**: Design documents from `/specs/009-python-pypi-sdk/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Python project in `python-sdk/` with `pyproject.toml` using hatchling
- [x] T002 [P] Create directory structure `python-sdk/src/ipfs_pay_to_pin_client/` and `python-sdk/tests/`
- [x] T003 [P] Add required dependencies (`requests`, `py-algorand-sdk`) to `pyproject.toml`
- [x] T004 [P] Configure pytest in `pyproject.toml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Create exceptions in `python-sdk/src/ipfs_pay_to_pin_client/exceptions.py`
- [x] T006 [P] Create `PinResponse` dataclass in `python-sdk/src/ipfs_pay_to_pin_client/models.py`
- [x] T007 Create `__init__.py` in `python-sdk/src/ipfs_pay_to_pin_client/__init__.py` to export models and exceptions

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Python AI Developer Pinning Files (Priority: P1) 🎯 MVP

**Goal**: As a Python developer, I want to install `ipfs-pay-to-pin-client` and pin files to IPFS using Algorand microUSDC payments in a single line.

**Independent Test**: Install the package locally, run a test script calling `client.pin_file(...)` with testnet credentials, and verify CID return.

### Tests for User Story 1 (OPTIONAL - only if tests requested) ⚠️

- [x] T008 [P] [US1] Create unit tests for client network interaction and Algorand signing in `python-sdk/tests/test_client.py`

### Implementation for User Story 1

- [x] T009 [US1] Implement `IpfsPayToPinClient` initialization and `get_status`, `renew_pin` in `python-sdk/src/ipfs_pay_to_pin_client/client.py`
- [x] T010 [US1] Implement `pin_bytes` and `pin_file` taking `PAYMENT-REQUIRED` challenge and signing x402 transaction in `python-sdk/src/ipfs_pay_to_pin_client/client.py`
- [x] T011 [US1] Add explicit rekey checking and budget limit checks (`max_price_usdc`) in `python-sdk/src/ipfs_pay_to_pin_client/client.py`
- [x] T012 [US1] Expose `IpfsPayToPinClient` in `python-sdk/src/ipfs_pay_to_pin_client/__init__.py`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Automated Post-Release CI Pipeline (Priority: P2)

**Goal**: As a maintainer, publishing a GitHub Release triggers building and publishing NPM and PyPI packages via OIDC.

**Independent Test**: Publish a pre-release or mock release and verify CI triggers and successfully exchanges OIDC token to PyPI.

### Implementation for User Story 2

- [x] T013 [P] [US2] Create GitHub Actions workflow for PyPI and NPM publishing in `.github/workflows/post-release.yml`
- [x] T014 [US2] Configure the workflow to trigger on `release: types: [published]` and `workflow_dispatch`
- [x] T015 [US2] Add NPM build/publish and PyPI build/publish steps (via `pypa/gh-action-pypi-publish`)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T016 [P] Write `README.md` in `python-sdk/README.md` with usage instructions
- [x] T017 [P] Run `quickstart.md` validation on the python SDK locally
- [x] T018 Code cleanup and type annotation verifications (PEP 561 `py.typed`) in `python-sdk/src/ipfs_pay_to_pin_client/py.typed`

---

## Completion Status

All tasks successfully completed and verified!
