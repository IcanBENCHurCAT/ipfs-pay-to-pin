# Tasks: Multi-Chain Base & Solana Payment Expansion

**Feature Directory**: `specs/009-multichain-base-solana`  
**Feature Name**: Multi-Chain Base & Solana Payment Expansion  
**Created**: 2026-08-10  

---

## Task Summary

- **Total Tasks**: 10
- **Phase 1 (Setup)**: 1 task
- **Phase 2 (Foundational)**: 2 tasks
- **Phase 3 (User Story 1 - Base L2 Gasless USDC)**: 3 tasks
- **Phase 4 (User Story 2 - Solana SPL USDC)**: 2 tasks
- **Phase 5 (User Story 3 - Ethereum L1 Volatility Protection)**: 1 task
- **Phase 6 (Polish & Cross-Cutting)**: 1 task

---

## Tasks

### Phase 1: Setup

- [ ] T001 Install `@x402/evm` and `@x402/svm` packages in [package.json](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/package.json)

### Phase 2: Foundational (Blocking Infrastructure)

- [ ] T002 Update `QueueItem` interface and `DbManager` mappings for multi-chain columns (`paymentNetwork`, `txHash`, `tokenAddress`, `payerAddress`, `amountPaid`, `settlementStatus`) in [src/queue.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/queue.ts) and [src/db.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/db.ts)
- [ ] T003 [P] Add unique composite index migration `(payment_network, tx_hash)` in [src/db.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/db.ts) for cross-chain replay protection

### Phase 3: User Story 1 - Base L2 Gasless USDC (Priority 1)

- [ ] T004 [P] [US1] Register `ExactEvmScheme` for Base L2 (`eip155:8453`) bound to `HTTPFacilitatorClient` in [src/index.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/index.ts)
- [ ] T005 [US1] Configure EIP-3009 (`transferWithAuthorization`) option payload in `@x402/hono` `accepts[]` array for `POST /api/v1/pin` in [src/index.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/index.ts)
- [ ] T006 [P] [US1] Implement Circuit Breaker fallback rule to return `503 Service Unavailable` on GoPlausible Facilitator 5xx downtime during EIP-3009 verification in [src/index.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/index.ts)

### Phase 4: User Story 2 - Solana SPL USDC (Priority 2)

- [ ] T007 [P] [US2] Register `ExactSvmScheme` for Solana (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`) bound to `HTTPFacilitatorClient` in [src/index.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/index.ts)
- [ ] T008 [US2] Add direct Solana RPC fallback driver (`confirmed` commitment level) for verifying pre-broadcasted base58 transaction signature hashes on Facilitator 5xx in [src/index.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/index.ts)

### Phase 5: User Story 3 - Ethereum L1 Volatility Protection (Priority 3)

- [ ] T009 [US3] Configure Ethereum L1 (`eip155:1`) option in `accepts[]` with dynamic gas surcharge floor ($2.50–$15.00) and 90s quote expiration TTL in [src/index.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/index.ts)

### Phase 6: Polish & Cross-Cutting Concerns

- [ ] T010 [P] Create multi-chain unit tests verifying CAIP-2 response headers and replay protection in [tests/multichain.test.ts](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/tests/multichain.test.ts)

---

## Dependencies & Execution Strategy

```
Phase 1 (Setup: T001)
  ↓
Phase 2 (Foundational: T002, T003)
  ↓
Phase 3 (User Story 1: T004, T005, T006) ──> MVP Deliverable
  ↓
Phase 4 (User Story 2: T007, T008)
  ↓
Phase 5 (User Story 3: T009)
  ↓
Phase 6 (Polish & Tests: T010)
```
