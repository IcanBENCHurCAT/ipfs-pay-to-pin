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
2.3. The smart contract MUST support configurable variables for Base Price (microALGOs) and Byte Price (microALGOs/byte). These MUST only be modifiable by the owner address.

### 3. HTTP x402 Protocol Compliance
3.1. Any request failing to present a valid transaction reference for the requested file upload MUST receive an HTTP `402 Payment Required` status code.
3.2. The response payload MUST include a JSON body containing the exact `amount` in microALGOs, the destination `escrow` address, and the `reference_id`.
3.3. The corresponding HTTP response headers MUST include:
   - `X-Algorand-Address`: The destination wallet address.
   - `X-Algorand-Amount`: The microALGO amount.
   - `X-Algorand-Txn-Ref`: The reference hash.

### 4. Direct IPFS Integration
4.1. File metadata and content MUST be uploaded to IPFS using standard IPFS client nodes or pinning services (e.g., Pinata).
4.2. Once pinned, the gateway MUST return the canonical IPFS content identifier (CIDv1 preferred, fallback to CIDv0) in a standard JSON response.

---

## II. Preferred Guidelines (SHOULD Principles)

### 5. Client Simplicity & UX
5.1. The API endpoints SHOULD be simple and fully self-documenting via FastAPI's Swagger UI.
5.2. Error responses SHOULD be human-readable, describing why a transaction verification failed (e.g., "Transaction amount too low", "Transaction sender mismatch").

### 6. Development Ergonomics
6.1. The workspace SHOULD provide mock pinning behavior for tests (`tests/`) so that tests do not require an active Pinata JWT or internet connection.
6.2. LocalNet/Sandbox scripts SHOULD be included to compile and deploy the `escrow` contract locally for testing.

---

**Version**: 1.0.0 | **Ratified**: 2026-07-20 | **Last Amended**: 2026-07-20
