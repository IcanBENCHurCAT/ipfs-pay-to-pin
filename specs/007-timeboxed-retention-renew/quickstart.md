# Quickstart Guide: 365-Day Retention & Renewal

This guide demonstrates how autonomous agents and API clients interact with the timeboxed retention and annual renewal features of the IPFS Pay-to-Pin Gateway.

---

## 1. Initial File Pinning (`POST /api/v1/pin`)

### Request

```http
POST /api/v1/pin HTTP/1.1
Host: localhost:4021
Content-Type: application/json

{
  "filename": "hello_world.txt",
  "data": "SGVsbG8gV29ybGQh"
}
```

### Initial Response (402 Payment Required)

```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <x402-encoded-challenge>
Content-Type: application/json

{
  "error": "Payment Required"
}
```

### Resubmission with Payment Signature

```http
POST /api/v1/pin HTTP/1.1
Host: localhost:4021
PAYMENT-SIGNATURE: <signed-tx-proof>
Content-Type: application/json

{
  "filename": "hello_world.txt",
  "data": "SGVsbG8gV29ybGQh"
}
```

### Response (`201 Created`)

```json
{
  "status": "success",
  "message": "Payment verified. File accepted and queued for 365 days of IPFS pinning.",
  "filename": "hello_world.txt",
  "ipfs_cid": "bafybeicg24y...",
  "cid": "bafybeicg24y...",
  "gateway_url": "https://gateway.pinata.cloud/ipfs/bafybeicg24y...",
  "pinned_at": "2026-07-29T10:15:00.000Z",
  "expires_at": "2027-07-29T10:15:00.000Z",
  "ttl_days": 365,
  "renewal_url": "/api/v1/renew?cid=bafybeicg24y..."
}
```

---

## 2. Checking Pin Status (`GET /api/v1/pin/:cid`)

Queries status for free without x402 payment headers.

### Request

```http
GET /api/v1/pin/bafybeicg24y... HTTP/1.1
Host: localhost:4021
```

### Response (`200 OK`)

```json
{
  "status": "PINNED",
  "cid": "bafybeicg24y...",
  "filename": "hello_world.txt",
  "size_bytes": 12,
  "pinned_at": "2026-07-29T10:15:00.000Z",
  "expires_at": "2027-07-29T10:15:00.000Z",
  "days_remaining": 365,
  "is_active": true,
  "renewals_count": 0,
  "gateway_url": "https://gateway.pinata.cloud/ipfs/bafybeicg24y..."
}
```

---

## 3. Annual Renewal (`POST /api/v1/renew`)

Extends an existing pin's retention by +365 days via x402 micropayment.

### Request

```http
POST /api/v1/renew HTTP/1.1
Host: localhost:4021
PAYMENT-SIGNATURE: <signed-tx-proof>
Content-Type: application/json

{
  "cid": "bafybeicg24y..."
}
```

### Response (`200 OK`)

```json
{
  "status": "success",
  "message": "Renewal payment verified. Storage extended for an additional 365 days.",
  "cid": "bafybeicg24y...",
  "pinned_at": "2026-07-29T10:15:00.000Z",
  "expires_at": "2028-07-29T10:15:00.000Z",
  "renewals_count": 1
}
```
