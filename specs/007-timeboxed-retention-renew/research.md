# Research: 365-Day Timeboxed Retention & Annual x402 Renewal

## 1. Local Storage Architecture for Retention & Expiration
- **Requirement**: Zero external cloud costs; persist metadata strictly in local storage.
- **Approach**: Extend `QueueItem` / `PinRecord` inside `queue/registry.json` maintained by `FileQueue` in `src/queue.ts`.
- **Fields to Store & Track**:
  - `pinned_at`: ISO 8601 string recorded when initial payment is verified and job is queued.
  - `expires_at`: ISO 8601 string calculated as exactly 365 days after `pinned_at` (or 365 days added to current `expires_at` upon renewal).
  - `ttl_days`: Remaining days until expiration (`365` initially).
  - `renewalsCount`: Number of annual renewals paid (defaults to `0`).
  - `sizeBytes`: File size in bytes (used for renewal pricing calculation).

## 2. API Extensions & x402 Integration

### A. Initial Upload (`POST /api/v1/pin`) Response Enhancement
- Include timeboxing metadata in the `201 Created` JSON payload:
  - `pinned_at`: ISO 8601 string (e.g. `2026-07-29T10:15:00.000Z`).
  - `expires_at`: ISO 8601 string set 365 days in future (e.g. `2027-07-29T10:15:00.000Z`).
  - `ttl_days`: `365`.
  - `renewal_url`: `/api/v1/renew?cid=<cid>`.

### B. Renewal Endpoint (`POST /api/v1/renew`)
- **Route**: `POST /api/v1/renew`
- **Protection**: `@x402/hono` `paymentMiddleware`.
- **Request Body**: `{ "cid": "<ipfs_cid>" }`.
- **Pricing Logic**:
  - Exact match with initial pin pricing: `$0.01` base fee ($10,000 microUSDC) + `$0.02` per MB (0.02 microUSDC per byte).
  - For renewal pricing dynamically computed in payment middleware, read the CID from request body or query param, lookup `sizeBytes` in `registry.json`, or default to standard base fee if size cannot be inspected beforehand.
- **Settlement Action**:
  - Verify CID exists in `queue/registry.json`. If not found, return `404 Not Found`.
  - Parse current `expires_at` (or fallback to `now` if already expired).
  - Extend `expires_at` by +365 days (`new Date(currentExpiresAt.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()`).
  - Increment `renewalsCount` by 1.
  - Persist updated registry.
  - Return `200 OK` JSON with updated `expires_at`, `pinned_at`, `renewals_count`, and `message`.

### C. Status Query Endpoint (`GET /api/v1/pin/:cid`)
- **Route**: `GET /api/v1/pin/:cid`
- **Protection**: None (Free public endpoint).
- **Behavior**:
  - Look up CID in `queue/registry.json`.
  - If not found, return `404 Not Found` with `{ "error": "Pin record not found" }`.
  - Calculate `days_remaining` = `Math.max(0, Math.ceil((expiresAtMs - Date.now()) / (1000 * 60 * 60 * 24)))`.
  - Determine `is_active` = `expiresAtMs > Date.now()`.
  - Return `200 OK` JSON containing `cid`, `filename`, `status`, `pinned_at`, `expires_at`, `days_remaining`, `is_active`, `renewals_count`, and `gateway_url`.

## 3. Zero-Cloud Cost Guarantee Verification
- Storage engine relies entirely on Node.js `fs` reading/writing `queue/registry.json`.
- No external DB (PostgreSQL, MongoDB, DynamoDB) or cloud storage (GCS, AWS S3) is required.
