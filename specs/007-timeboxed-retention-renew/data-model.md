# Data Model: 365-Day Timeboxed Retention & Annual x402 Renewal

## Database Schema (`pin_records` Table)

Third Normal Form (3NF) compliant. Only primitive, non-derived fields are persisted to Supabase and local JSON fallback.

```sql
CREATE TABLE IF NOT EXISTS pin_records (
    cid TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    renewals_count INTEGER NOT NULL DEFAULT 0 CHECK (renewals_count >= 0),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PINNED', 'FAILED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pin_records_expires_at ON pin_records(expires_at);
```

## Field Classification

### Stored Fields (Persisted in Supabase & `queue/registry.json`)
- `cid` (string, PK): Canonical IPFS Content Identifier.
- `filename` (string): Original file name.
- `size_bytes` (number): Size of the file in bytes.
- `pinned_at` (ISO 8601 string): Initial upload timestamp.
- `expires_at` (ISO 8601 string): Current expiration timestamp (+365 days from initial pin or last renewal).
- `renewals_count` (number): Number of paid annual renewals (default: 0).
- `status` (string): Current status (`PENDING` | `PINNED` | `FAILED`).

### Derived Fields (Computed at Runtime — DO NOT STORE in DB)
- `ttl_days`: `365` (or calculated as `expires_at - pinned_at`).
- `days_remaining`: `MAX(0, Math.ceil((expires_at - Date.now()) / (1000 * 60 * 60 * 24)))`.
- `is_active`: `(new Date(expires_at) > new Date()) && status === 'PINNED'`.
- `renewal_url`: `"/api/v1/renew?cid=" + cid`.

## API Responses (DTOs)

### `POST /api/v1/pin` Response DTO (201 Created)
```json
{
  "status": "success",
  "message": "Payment verified. File accepted and queued for 365 days of IPFS pinning.",
  "filename": "dataset.json",
  "ipfs_cid": "bafybeig...",
  "cid": "bafybeig...",
  "gateway_url": "https://gateway.pinata.cloud/ipfs/bafybeig...",
  "pinned_at": "2026-07-29T10:00:00.000Z",
  "expires_at": "2027-07-29T10:00:00.000Z",
  "ttl_days": 365,
  "renewal_url": "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/renew?cid=bafybeig..."
}
```

### `POST /api/v1/renew` Response DTO (200 OK)
```json
{
  "status": "success",
  "message": "Payment verified. IPFS pin retention extended by 365 days.",
  "cid": "bafybeig...",
  "pinned_at": "2026-07-29T10:00:00.000Z",
  "expires_at": "2028-07-29T10:00:00.000Z",
  "renewals_count": 1,
  "renewal_url": "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/renew?cid=bafybeig..."
}
```

### `GET /api/v1/pin/:cid` Response DTO (200 OK)
```json
{
  "status": "success",
  "cid": "bafybeig...",
  "filename": "dataset.json",
  "size_bytes": 1048576,
  "pinned_at": "2026-07-29T10:00:00.000Z",
  "expires_at": "2027-07-29T10:00:00.000Z",
  "days_remaining": 365,
  "is_active": true,
  "renewals_count": 0,
  "gateway_url": "https://gateway.pinata.cloud/ipfs/bafybeig...",
  "renewal_url": "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/renew?cid=bafybeig..."
}
```
