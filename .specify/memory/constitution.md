<!--
Sync Impact Report:
- Version change: 1.2.0 → 1.3.0 (Minor version bump updating constitution to reflect ADR 0005 & ADR 0006)
- Added Section I.9 (Production Packaging & Client SDKs): Mandates multi-stage Docker containerization with Caddy TLS and maintenance of official client SDKs (TypeScript & Python).
- Updated Section I.5 (Fault Tolerance and Reliability): Incorporated atomic state persistence requirements from ADR 0005.
- Updated Section I.3 (HTTP x402 Protocol Compliance): Re-confirmed standard @x402/hono header standards.
- Templates requiring updates:
  - ✅ `.specify/templates/plan-template.md` (Updated Constitution Check header references)
-->
# IPFS Pay-to-Pin Gateway Constitution

## Overview
This document defines the prescriptive architectural rules, engineering standards, and governance policies for the IPFS Pay-to-Pin Gateway. All plans, specifications, tasks, and implementations MUST comply with the principles detailed below.

---

## I. Non-Negotiable Guardrails (MUST Principles)

### 1. Legal and Regulatory Compliance
1.1. The gateway MUST NOT bypass local or international data hosting laws.
1.2. The system MUST implement access controls to reject pinning of demonstrably malicious payloads (e.g., malware, illegal content) through basic content type checks or automated scanning integration.

### 2. Smart Contract Correctness
2.1. The gateway fee rules and contract code MUST be written in Algorand Python (`algopy`) and compiled using Puya compiler.
2.2. All critical smart contract methods MUST verify that `Txn.rekey_to()` remains unmodified (`Account(0)`), preventing account takeover.
2.3. The smart contract MUST support configurable variables for Base Price and Byte Price in microUSDC. These MUST only be modifiable by the owner address.

### 3. HTTP x402 Protocol Compliance
3.1. The gateway backend MUST be built using the standard `@x402/hono` middleware (running on Hono/TypeScript).
3.2. Any request failing to present a valid transaction reference for the requested file upload MUST receive an HTTP `402 Payment Required` status code.
3.3. The 402 response MUST include the standard `PAYMENT-REQUIRED` header containing the x402 challenge outlining the required microUSDC payment on Algorand.
3.4. The client MUST resubmit the original request with the `PAYMENT-SIGNATURE` header containing the signed transaction proof for verification.

### 4. Direct IPFS Integration & Timeboxed Retention
4.1. File metadata and content MUST be uploaded to IPFS using standard IPFS client nodes or pinning services (e.g., Pinata).
4.2. Once pinned, the gateway MUST return the canonical IPFS content identifier (CIDv1 preferred, fallback to CIDv0) in a standard JSON response.
4.3. The system MUST guarantee a **maximum retention period of 365 days** per payment for any pinned content. Expiration metadata (`expires_at`, `ttl_days`, `renewal_url`) MUST be returned in API pin responses so clients can track expiration and trigger renewal payments via `/renew`.

### 5. Fault Tolerance, Queue Hardening, and Atomic Persistence
5.1. The gateway MUST implement a Circuit Breaker middleware that evaluates system health before the x402 payment middleware is reached. It MUST return a `503 Service Unavailable` if the local queue is full or Pinata is down, preventing agents from paying for dropped storage requests.
5.2. The gateway MUST utilize a local buffer queue to persist payloads immediately upon payment verification, decoupling the synchronous Pinata upload from the client response to prevent timeouts and lost funds.
5.3. All file registry state writes MUST perform atomic file replacements (e.g., writing to a `.tmp` path before renaming over `registry.json`) to prevent database corruption across unexpected power cuts or container restarts (ADR 0005).

### 6. Production Packaging & Client SDKs
6.1. The server deployment MUST use multi-stage Docker containerization behind a production-grade reverse proxy (e.g., Caddy 2) supporting automatic TLS certification (ADR 0005).
6.2. Official client libraries for Node.js/TypeScript and Python (`ipfs-pay-to-pin-client`) MUST be maintained, supporting client-side x402 challenge handling, microUSDC transaction signing, account rekey checks, and budget safety ceilings (`max_price_usdc`) (ADR 0006).

---

## II. Preferred Guidelines (SHOULD Principles)

### 7. Client Simplicity & UX
7.1. The API endpoints SHOULD be simple and fully self-documenting via Swagger UI (`/docs`) and OpenAPI specifications (`/openapi.json`).
7.2. Error responses SHOULD be human-readable, describing why a transaction verification failed (e.g., "Transaction amount too low", "Transaction sender mismatch").

### 8. Development Ergonomics & Testing
8.1. The workspace SHOULD provide mock pinning behavior for tests (`tests/`) so that tests do not require an active Pinata JWT or internet connection.
8.2. LocalNet/Sandbox scripts SHOULD be included to compile and deploy the `escrow` contract locally for testing.

### 9. Multi‑Gateway Fallback
9.1. Optional deployment of a **multi‑gateway fallback** mechanism, with health‑checked public gateways (e.g., Cloudflare IPFS, Fleek), to ensure high‑availability access when the primary Pinata endpoint is unreachable.

### 10. GCP Lifecycle Enforcement
10.1. Optional deployment of a **GCP bucket lifecycle rule** that automatically deletes objects older than 365 days, reinforcing the 365‑day retention guarantee at the storage layer.

---

## III. Governance & Amendments

- **Amendment Policy**: Any changes to MUST principles require a MAJOR version bump. Adding new MUST/SHOULD principles or expanding guidance requires a MINOR version bump. Clarifications and minor edits require a PATCH version bump.
- **Review Policy**: All pull requests must pass the Constitution Check in `plan-template.md` before merging.

---

**Version**: 1.3.0 | **Ratified**: 2026-07-20 | **Last Amended**: 2026-08-09
