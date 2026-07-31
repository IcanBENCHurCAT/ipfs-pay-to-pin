# 4: 365-Day Timeboxed Retention & Annual x402 Renewal

This document details the architectural decisions made during the implementation of the 365-Day Timeboxed Retention & Annual x402 Renewal feature.

---

## Status
Approved / Implemented

## Context & Problem
Promising "forever storage" for a single one-off payment creates an unpriceable long-term financial liability. As storage nodes operate continuously, un-renewed legacy files accumulate endlessly, swelling Pinata cloud storage usage without generating revenue.

## Decision
1. Enforce a 365-day initial retention window on all file uploads (`POST /api/v1/pin`), returning `pinned_at`, `expires_at` (+365 days), `ttl_days: 365`, and `renewal_url`.
2. Expose an annual renewal endpoint `POST /api/v1/renew` protected by `@x402/hono` micropayment middleware.
3. Provide a 50% Early Renewal Discount (5,000 microUSDC) prior to expiration, extending `expires_at` by +365 days from the previous expiration date.
4. Enforce a 30-day grace period post-expiration (Days 365–395) charging 100% standard price (10,000 microUSDC).
5. Implement automatic background garbage collection (`processExpiredPins()`) in `src/queue.ts` executing `unpinFileFromIPFS(cid)` when `NOW > expires_at + 30 days` (395 days total).
6. Expose a free `GET /api/v1/pin/:cid` status lookup endpoint calculating derived runtime fields (`days_remaining`, `is_active`).

## Consequences
- Prevents storage nodes from accumulating abandoned data indefinitely.
- Frees up Pinata account file storage limits automatically via unpinning.
- Requires recurring economic activity (microUSDC micropayments) to keep pins active.
- Clients receive clear retention timestamps and early renewal discount incentives.

## Superseded Decisions
None. Extends ADR 0001 (Pluggable Storage) and ADR 0003 (Payment Challenge).
