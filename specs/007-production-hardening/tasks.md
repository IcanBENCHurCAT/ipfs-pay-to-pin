# Tasks: Production Containerization & Queue Hardening

**Input**: Design documents from `/specs/007-production-hardening/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/docker-infrastructure.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Build system configuration for production compilation

- [ ] T001 [P] Add root `"build": "tsc"` script in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core container files required before user stories can run

- [ ] T002 Create multi-stage `Dockerfile` in root directory
- [ ] T003 Create `Caddyfile` reverse proxy configuration in root directory
- [ ] T004 Create `docker-compose.yml` orchestrating `app`, `caddy`, and `duckdns` services in root directory

---

## Phase 3: User Story 1 - Containerized Production Deployment & Automated SSL (Priority: P1) 🎯 MVP

**Goal**: Package application and reverse proxy to deploy on free-tier virtual machines with automatic DuckDNS Let's Encrypt TLS certification.

**Independent Test**: Build Docker image (`docker build -t ipfs-pay-to-pin .`) and launch stack (`docker compose up -d`), verifying services start cleanly and proxy HTTP to app on port 4021.

- [ ] T005 [P] [US1] Update `.env.example` to document `DUCKDNS_SUBDOMAIN` and `DUCKDNS_TOKEN` in `.env.example`
- [ ] T006 [US1] Test container compilation via `pnpm run build` and `docker build -t ipfs-pay-to-pin .`
- [ ] T007 [US1] Validate local stack boot via `docker compose up -d`

---

## Phase 4: User Story 2 - Atomic Queue File Persistence (Priority: P2)

**Goal**: Prevent registry state corruption under concurrent load and ensure file queue buffer persistence across container restarts.

**Independent Test**: Run concurrent queue saves and verify atomic `.tmp` file write and rename pattern prevents corrupted JSON files.

- [ ] T008 [US2] Implement atomic write helper (`saveAtomic`) in `src/queue.ts` using temporary file creation and synchronous rename
- [ ] T009 [US2] Update `FileQueue` methods in `src/queue.ts` to persist items using `saveAtomic`
- [ ] T010 [US2] Verify persistent volume mapping `/app/queue` in `docker-compose.yml`

---

## Phase 5: User Story 3 - Deterministic Expired Pin Retention Status (Priority: P3)

**Goal**: Standardize error handling on pin renewal for CIDs whose grace period has expired to consistently return HTTP 410 Gone.

**Independent Test**: Query `/api/v1/renew` for an expired CID both before and after background cleanup to confirm deterministic `410 Gone` HTTP status.

- [ ] T011 [US3] Update `findByCid()` query logic in `src/queue.ts` to retrieve expired items regardless of status `'FAILED'`
- [ ] T012 [US3] Verify `/api/v1/renew` handler in `src/index.ts` returns HTTP 410 Gone for expired CIDs

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation, and cleanup

- [ ] T013 [P] Execute existing test suite via `pnpm test`
- [ ] T014 [P] Update `README.md` with Docker Compose and DuckDNS deployment instructions
- [ ] T015 Run validation scenarios from `specs/007-production-hardening/quickstart.md`

---

## Dependencies & Execution Order

1. **Setup & Foundational (T001-T004)**: Must complete first.
2. **User Story 1 (T005-T007)**: Build & boot container MVP.
3. **User Story 2 (T008-T010)**: Queue persistence & atomic write hardening.
4. **User Story 3 (T011-T012)**: Deterministic 410 error code handling.
5. **Polish (T013-T015)**: Test suite pass and README documentation update.
