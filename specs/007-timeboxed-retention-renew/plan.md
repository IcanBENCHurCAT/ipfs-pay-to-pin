# Implementation Plan: 365-Day Timeboxed Retention & Annual x402 Renewal

**Branch**: `007-timeboxed-retention-renew` | **Date**: 2026-07-29 | **Spec**: [spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/007-timeboxed-retention-renew/spec.md)

**Input**: Feature specification from `/specs/007-timeboxed-retention-renew/spec.md`

## Summary

This plan outlines the technical design for timeboxing IPFS pins to 365 days, enabling annual renewals via `@x402/hono` micropayments, and providing a free public status endpoint (`GET /api/v1/pin/:cid`). All retention metadata (`pinned_at`, `expires_at`, `size_bytes`, `renewals_count`) is persisted in Supabase (`pin_records` table) using `@supabase/supabase-js`, with graceful fallback to the local queue registry (`queue/registry.json`) when Supabase credentials are not present.

## Technical Context

**Language/Version**: TypeScript / Node.js ES Modules (Node 20+)
**Primary Dependencies**: Hono, `@hono/node-server`, `@x402/hono`, `@x402/core`, `@x402/avm`, `@supabase/supabase-js`
**Storage**: Supabase Postgres (`pin_records` table) + Local JSON fallback (`queue/registry.json`)
**Testing**: Vitest / Node native test runner (`npm test`)
**Target Platform**: Node.js Server (Heroku / Local execution)
**Project Type**: Web Service (Hono REST API)
**Performance Goals**: <50ms response for pin / renew settlement, <10ms for free status lookup.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Smart Contract Language**: Smart contract written in `algopy` (Puya). (Unchanged for this endpoint feature).
- [x] **RekeyTo Protection**: Maintained in `escrow/contract.py`.
- [x] **Owner-only Configuration**: Contract fee config restricted to contract owner.
- [x] **HTTP x402 Protocol Compliance**: Endpoints `/api/v1/pin` and `/api/v1/renew` protected via `@x402/hono` `paymentMiddleware` with standard `PAYMENT-REQUIRED` and `PAYMENT-SIGNATURE` headers.
- [x] **IPFS Pinning Integration**: IPFS pinning decoupled via local buffer queue (`src/queue.ts`), generating deterministic CIDv1s and pinning asynchronously.

## Project Structure

### Documentation (this feature)

```text
specs/007-timeboxed-retention-renew/
├── plan.md              # This file
├── research.md          # Research on retention tracking & x402 endpoints
├── data-model.md        # Data schemas & API response formats
└── quickstart.md        # Curl & HTTP examples for pin, renew, and status endpoints
```

### Source Code (repository root)

```text
src/
├── index.ts             # Hono endpoints: POST /api/v1/pin, POST /api/v1/renew, GET /api/v1/pin/:cid
├── queue.ts             # FileQueue class, registry.json read/write, QueueItem interface extension
├── cid.ts               # Local CID calculation utility
├── storage.ts           # Pinata upload handler
└── middleware/
    ├── circuitBreaker.ts # Health check prior to x402 payment
    └── rateLimiter.ts    # Sliding window rate limiter

tests/
├── queue.test.ts        # Unit test for FileQueue retention field calculations and updates
└── api.test.ts          # End-to-end endpoint tests for pin, renew, and status
```

**Structure Decision**: Single project layout using existing `src/` modular organization.

## Key Changes & Architecture

1. **`src/queue.ts` Enhancements**:
   - Update `QueueItem` interface to include `sizeBytes`, `pinned_at`, `expires_at`, `ttl_days`, `renewalsCount`.
   - Update `addJob()` method to accept `buffer: Buffer` and calculate `sizeBytes`, `pinned_at` (`new Date().toISOString()`), `expires_at` (`pinned_at + 365 days`), `ttl_days: 365`, `renewalsCount: 0`.
   - Add helper method `renewPin(cid: string)` to locate an existing pinned item, extend its `expires_at` by 365 days, increment `renewalsCount`, and save `registry.json`.
   - Add helper method `getPinStatus(cid: string)` to return calculated status details including `days_remaining` and `is_active`.

2. **`src/index.ts` Enhancements**:
   - **`POST /api/v1/pin`**: Update return payload to include `pinned_at`, `expires_at`, `ttl_days: 365`, and `renewal_url: "/api/v1/renew?cid=<cid>"`.
   - **`POST /api/v1/renew`**:
     - Protect route under `@x402/hono` `paymentMiddleware` with microUSDC pricing ($0.01 base + $0.02/MB based on pinned file size).
     - Handler inspects body `{ cid }`, calls `globalFileQueue.renewPin(cid)`, and returns `200 OK` with updated timestamps and `renewals_count`.
     - Returns `404 Not Found` if CID is missing from registry.
   - **`GET /api/v1/pin/:cid`**:
     - Unprotected public endpoint.
     - Calls `globalFileQueue.getPinStatus(cid)`. Returns `200 OK` with status object or `404 Not Found` if missing.
   - Update `/openapi.json` and agent onboarding documents (`llms.txt`, `/.well-known/agent-card.json`) to register `/api/v1/renew` and `/api/v1/pin/:cid`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
