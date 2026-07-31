# Feature Specification: 365-Day Timeboxed Retention & Annual x402 Renewal

**Feature Branch**: `[007-timeboxed-retention-renew]`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "implement the 365 day + renew logic without external paid cloud VMs, GCS, or extra infrastructure costs"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Timeboxed Pinning Confirmation (Priority: P1)

As an autonomous agent, I want my initial `POST /api/v1/pin` upload response to explicitly state the 365-day expiration timestamp (`expires_at`) and a renewal URL, so I know exactly when my pin requires an annual retention payment.

**Why this priority**: "Forever" is an unpriceable liability. Timeboxing pins for 1 year sets transparent expectations and gives agents clear metadata for scheduled maintenance.

**Independent Test**: Upload a payload to `POST /api/v1/pin`, satisfy the 402 challenge, and verify that the response contains `pinned_at`, `expires_at` (+365 days), `ttl_days: 365`, and `renewal_url`.

**Acceptance Scenarios**:

1. **Given** a successful file upload and x402 payment, **When** the server responds with 201 Created, **Then** the JSON payload contains `expires_at` set to exactly 365 days in the future.
2. **Given** an agent receives the pin response, **When** they inspect `renewal_url`, **Then** it points to `/api/v1/renew?cid=<cid>`.

---

### User Story 2 - Annual Renewal via x402 Micropayment (Priority: P1)

As an autonomous agent, I want to renew an existing IPFS pin for another 365 days by sending a `POST /api/v1/renew` request and paying an x402 microUSDC challenge, so I can maintain recurring decentralized storage for my files without re-uploading data.

**Why this priority**: Annual renewals create recurring revenue for the gateway operator and provide agents with a reliable method to extend storage lifespan programmatically.

**Independent Test**: Call `POST /api/v1/renew` with a valid `cid`, satisfy the 402 payment challenge, and verify that `expires_at` is extended by 365 days.

**Acceptance Scenarios**:

1. **Given** an active pinned CID, **When** an agent calls `POST /api/v1/renew` with `{ "cid": "bafybeig..." }`, **Then** the server responds with `402 Payment Required` containing an x402 challenge.
2. **Given** the x402 renewal challenge is settled, **When** the agent resubmits the request with `PAYMENT-SIGNATURE`, **Then** the server updates `expires_at` by adding 365 days and returns `200 OK`.
3. **Given** a CID that is not registered in the gateway, **When** an agent calls `POST /api/v1/renew`, **Then** the server returns `404 Not Found`.

---

### User Story 3 - Public Pin Status Endpoint (Priority: P2)

As an agent or developer, I want to query `GET /api/v1/pin/:cid` for free, so I can check a file's retention status, `expires_at`, and remaining days without triggering a 402 payment challenge.

**Why this priority**: Agents need a lightweight method to audit their storage health before deciding whether to trigger a `/renew` payment.

**Independent Test**: Query `GET /api/v1/pin/bafybeig...` and verify it returns status `200 OK` with `days_remaining` and `is_active: true`.

**Acceptance Scenarios**:

1. **Given** a pinned CID in the registry, **When** `GET /api/v1/pin/:cid` is called, **Then** the server returns JSON containing `status`, `expires_at`, `days_remaining`, and `is_active: true` with zero payment headers required.
2. **Given** an unpinned/unknown CID, **When** `GET /api/v1/pin/:cid` is called, **Then** the server returns `404 Not Found`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST calculate `expires_at` as ISO 8601 string (+365 days from `pinned_at`) upon initial upload verification.
- **FR-002**: `POST /api/v1/pin` response JSON MUST include `pinned_at`, `expires_at`, `ttl_days: 365`, and `renewal_url`.
- **FR-003**: System MUST expose a `POST /api/v1/renew` endpoint protected by `@x402/hono` `paymentMiddleware`.
- **FR-004**: System MUST calculate renewal price with an **Early Renewal Discount** (50% discount on microUSDC fee) if renewed prior to `expires_at` (`expires_at > NOW()`). If renewed during the 30-day grace period (`expires_at < NOW() <= expires_at + 30 days`), standard 100% pricing applies.
- **FR-005**: System MUST extend `expires_at` by +365 days upon verified renewal payment.
- **FR-006**: System MUST expose a free `GET /api/v1/pin/:cid` status endpoint.
- **FR-007**: System MUST run an automated cleanup process that unpins files from Pinata (`unpin(cid)`) and marks status as `EXPIRED` once a pin exceeds `expires_at + 30 days` (365 + 30 days total).
- **FR-008**: System MUST support persisting retention records (`pin_records` table) to Supabase (using `@supabase/supabase-js`), falling back gracefully to local file registry (`queue/registry.json`).

### Key Entities

- **PinRecord**: Represents a pinned file and its timeboxed retention window.
  - `cid` (string): Canonical IPFS CID.
  - `filename` (string): Original file name.
  - `size_bytes` (number): Size of the file in bytes.
  - `pinned_at` (string): ISO 8601 timestamp.
  - `expires_at` (string): ISO 8601 timestamp.
  - `renewals_count` (number): Count of annual renewals paid.
  - `status` (string): `PINNED` | `PENDING` | `EXPIRED`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful pin responses include `expires_at` and `renewal_url`.
- **SC-002**: Successful `/renew` payment extends `expires_at` by exactly 365 days within <50ms of payment verification.
- **SC-003**: `GET /api/v1/pin/:cid` returns status within <10ms from Supabase (or local fallback).

## Assumptions

- Supabase DB configuration reads from `SUPABASE_URL` and `SUPABASE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) in `.env`.
- Local JSON registry (`queue/registry.json`) serves as automatic fallback during local development or offline testing.
- Renewal price uses the same microUSDC per MB pricing logic as initial pinning.
