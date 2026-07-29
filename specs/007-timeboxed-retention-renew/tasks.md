# Tasks: 365-Day Timeboxed Retention & Annual x402 Renewal

**Input**: Design documents from `/specs/007-timeboxed-retention-renew/`

**Prerequisites**: plan.md (required), spec.md (required), data-model.md, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Includes exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure & Dependencies)

**Purpose**: Dependency installation and database schema initialization setup

- [ ] T001 Install `@supabase/supabase-js` dependency in `package.json`
- [ ] T002 Update environment configuration schema in `src/config.ts` (or `.env` environment loading) to support `SUPABASE_URL` and `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- [ ] T003 [P] Create database migration / schema setup script in `specs/007-timeboxed-retention-renew/schema.sql` for the `pin_records` table

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB Manager module and local fallback registry extensions that MUST be complete before user story endpoints

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create DB manager abstraction module in `src/db.ts` with `@supabase/supabase-js` client initialization and fallback logic for local registry persistence
- [ ] T005 [P] Update `QueueItem` interface and file registry schema in `src/queue.ts` to include retention fields (`sizeBytes`, `pinned_at`, `expires_at`, `ttl_days`, `renewalsCount`)
- [ ] T006 Extend `FileQueue` class in `src/queue.ts` to initialize and synchronize records through `src/db.ts` with local fallback to `queue/registry.json`

**Checkpoint**: Foundation ready - DB manager and updated queue data models ready. User story implementation can now begin.

---

## Phase 3: User Story 1 - Timeboxed Pinning Confirmation (Priority: P1) 🎯 MVP

**Goal**: Update initial `POST /api/v1/pin` file upload endpoint to record initial retention timestamps (+365 days expiration) and return derived retention fields (`pinned_at`, `expires_at`, `ttl_days: 365`, `renewal_url`).

**Independent Test**: Upload a file payload to `POST /api/v1/pin`, satisfy the x402 challenge, and verify that the 201 Created response JSON contains `pinned_at`, `expires_at` (exactly 365 days in future), `ttl_days: 365`, and `renewal_url`.

### Tests for User Story 1

- [ ] T007 [P] [US1] Unit test retention calculation logic for initial pinning in `tests/queue.test.ts`
- [ ] T008 [P] [US1] Integration test for `POST /api/v1/pin` response retention metadata payload in `tests/api.test.ts`

### Implementation for User Story 1

- [ ] T009 [US1] Update `addJob()` method in `src/queue.ts` to calculate `pinned_at` (current ISO timestamp), `expires_at` (+365 days), `ttl_days: 365`, `renewalsCount: 0`, and persist via `src/db.ts` / local registry fallback
- [ ] T010 [US1] Update `POST /api/v1/pin` endpoint handler in `src/index.ts` to include `pinned_at`, `expires_at`, `ttl_days`, and `renewal_url` in the 201 response JSON

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently (MVP complete).

---

## Phase 4: User Story 2 - Annual Renewal via x402 Micropayment (Priority: P1)

**Goal**: Expose an annual `POST /api/v1/renew` endpoint protected by `@x402/hono` middleware that extends an existing pin's `expires_at` timestamp by +365 days upon verified payment.

**Independent Test**: Call `POST /api/v1/renew` with a valid `cid`, satisfy the x402 payment challenge, and verify that `expires_at` is extended by 365 days and `renewals_count` incremented.

### Tests for User Story 2

- [ ] T011 [P] [US2] Unit test `renewPin(cid)` logic in `tests/queue.test.ts` for extending `expires_at` and incrementing `renewalsCount`
- [ ] T012 [P] [US2] End-to-end integration test for `POST /api/v1/renew` with x402 middleware challenge and settlement in `tests/api.test.ts`

### Implementation for User Story 2

- [ ] T013 [US2] Implement `renewPin(cid: string)` helper in `src/queue.ts` to fetch record, compute new `expires_at` (+365 days), increment `renewalsCount`, and persist to DB/registry
- [ ] T014 [US2] Configure `@x402/hono` payment middleware for `POST /api/v1/renew` in `src/index.ts` with 50% Early Renewal Discount prior to `expires_at`, 100% price during 30-day grace period, and rejection (410 Gone) after 395 days
- [ ] T015 [US2] Implement `POST /api/v1/renew` request handler in `src/index.ts` processing `{ cid }`, invoking `renewPin(cid)`, and returning 200 OK or 404/410 errors
- [ ] T015b [US2] Implement `unpinFileFromIPFS(cid: string)` in `src/storage.ts` and `processExpiredPins()` background sweeper in `src/queue.ts` unpinning files from Pinata when `NOW() > expires_at + 30 days` (395 days total)

**Checkpoint**: User Story 2 complete - annual renewal flow functional with early discount and automated grace period unpinning.

---

## Phase 5: User Story 3 - Public Pin Status Endpoint (Priority: P2)

**Goal**: Provide a free, unprotected `GET /api/v1/pin/:cid` endpoint returning storage retention status, remaining days, and active state without requiring payment headers.

**Independent Test**: Query `GET /api/v1/pin/:cid` for a known CID and verify it returns status 200 OK with `days_remaining`, `is_active`, `expires_at`, and `renewals_count`.

### Tests for User Story 3

- [ ] T016 [P] [US3] Unit test `getPinStatus(cid)` calculation in `tests/queue.test.ts` (verifying `days_remaining` and `is_active` logic)
- [ ] T017 [P] [US3] Integration test for `GET /api/v1/pin/:cid` (200 OK for valid CID, 404 for invalid CID) in `tests/api.test.ts`

### Implementation for User Story 3

- [ ] T018 [US3] Implement `getPinStatus(cid: string)` helper in `src/queue.ts` to compute runtime derived fields (`days_remaining`, `is_active`, `ttl_days`, `renewal_url`)
- [ ] T019 [US3] Implement `GET /api/v1/pin/:cid` route handler in `src/index.ts` returning JSON response DTO or 404 Not Found

**Checkpoint**: All user stories implemented and independently testable.

---

## Phase 6: Polish & Documentation Updates

**Purpose**: Documentation updates, OpenAPI alignment, and quickstart validation

- [ ] T020 [P] Update `openapi.json` and agent onboarding documents (`llms.txt`, `/.well-known/agent-card.json`) to include `/api/v1/renew` and `/api/v1/pin/:cid` endpoints
- [ ] T021 [P] Verify quickstart examples in `specs/007-timeboxed-retention-renew/quickstart.md` using `npm test`
- [ ] T022 Run test suite across all modules (`npm test`) to ensure zero regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-5)**: All depend on Foundational phase completion
  - US1 (P1) -> US2 (P1) -> US3 (P2)
- **Polish (Phase 6)**: Depends on all user stories completion

### Parallel Opportunities

- T003 (Schema setup) in Phase 1
- T005 (Queue interface update) in Phase 2
- Test tasks (T007, T008, T011, T012, T016, T017) within each User Story phase
- T020 and T021 in Phase 6

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 & 2 (Setup & Foundational DB Manager + Queue extensions)
2. Complete Phase 3 (User Story 1: `POST /api/v1/pin` response update)
3. Validate US1 with unit & integration tests

### Incremental Delivery

1. Add Phase 4 (User Story 2: `POST /api/v1/renew` annual x402 payment)
2. Add Phase 5 (User Story 3: `GET /api/v1/pin/:cid` free status endpoint)
3. Complete Phase 6 (Polish & Documentation)
