# v3: x402 Dynamic Payment Challenge & Local Verification (AB-PP-002)

This document details the architectural decisions made during the implementation of the x402 Dynamic Payment Challenge & Local Verification feature.

---

## Status
Approved / Implemented

## Context & Problem
The pay-to-pin gateway needed to enforce a micropayment-gated API flow where clients upload files, get billed dynamically based on file size and smart contract rates, pay on-chain, and submit the txn reference to finalize the pin.

## Decision
1. **HTTP x402 Compliance**: Returned standard HTTP 402 Payment Required for unverified uploads, including `X-Algorand-Address`, `X-Algorand-Amount`, and `X-Algorand-Txn-Ref` custom headers, and challenge details in JSON body.
2. **On-Chain Verification**: Implemented `verify_transaction` using `algosdk` checking receiver address, payment amount, UTF-8 decoded note field, and confirmed round status.
3. **Double-Spend Prevention**: Tracked successfully verified transaction IDs in a spent registry `spent_txns` to prevent reuse.
4. **Temporary Cache & Cleanup**: Cached files temporarily in memory using a dictionary keyed by reference ID. Automated a FastAPI `BackgroundTasks` eviction worker running every request to evict unpaid challenges older than 10 minutes (TTL).

## Consequences
* **Positive**:
  - Fully compliant with the custom x402 gateway headers.
  - Robust on-chain checks preventing double spending.
  - TTL eviction limits memory consumption on spam uploads.
* **Negative**:
  - In-memory challenge storage does not persist across gateway restarts (suitable for mock/test but requires persistence like Redis for production).

## Superseded Decisions
None.
