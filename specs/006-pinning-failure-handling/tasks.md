# Tasks: Pinning Failure Handling

## Phase 1: Setup & Data Models

- [ ] T001 Create queue directory structure in `queue/`
- [ ] T002 Implement queue data structures and types in `src/queue.ts`

## Phase 2: Foundational Components

- [ ] T003 Implement local CID calculation helper in `src/cid.ts` (computes sha256/v1 CID locally so client receives CID immediately)
- [ ] T004 Implement `FileQueue` class in `src/queue.ts` with job persistence and background worker loop
- [x] T003 Implement local CID calculation helper in `src/cid.ts` (computes sha256/v1 CID locally so client receives CID immediately)
- [x] T004 Implement `FileQueue` class in `src/queue.ts` with job persistence and background worker loop

## Phase 3: User Story 1 - Graceful Queueing of Uploads (Priority: P1)

Goal: Decouple client payment verification from synchronous Pinata uploads by buffering requests locally.
Independent Test: Disconnect Pinata API keys, upload file with payment signature, verify 201 Created with correct CID returned instantly.

- [x] T005 [P] [US1] Update `POST /api/v1/pin` handler in `src/index.ts` to compute local CID and add job to `FileQueue` instead of synchronous Pinata call
- [x] T006 [US1] Implement background worker polling in `src/queue.ts` to drain queue items and upload to Pinata via `pinFileToStorage`
- [x] T007 [US1] Add job retry tracking (up to 100 retries) in `src/queue.ts` for handling extended Pinata outages

## Phase 4: User Story 2 - Circuit Breaker Rejection (Priority: P2)

Goal: Automatically reject incoming upload requests before issuing 402 payment challenges if the local queue is at capacity.
Independent Test: Fill local queue to capacity (50 items), verify subsequent `POST /api/v1/pin` returns 503 Service Unavailable immediately.

- [x] T008 [P] [US2] Implement `circuitBreaker` middleware in `src/middleware/circuitBreaker.ts` checking queue size
- [x] T009 [US2] Register `circuitBreaker` middleware in `src/index.ts` prior to `paymentMiddleware`

## Phase 5: Polish & Deduplication

- [x] T010 [P] Implement deduplication check in `src/queue.ts` (if CID is already pinned in local registry/Pinata, immediately return pinned status)
- [x] T011 Verify end-to-end flow with test script `scripts/test_queue_breaker.ts`
