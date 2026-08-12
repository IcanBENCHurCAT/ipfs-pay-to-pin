# Phase 0: Research Findings - Multi-Chain Base & Solana Payment Expansion

**Feature Directory**: `specs/009-multichain-base-solana`  
**Created**: 2026-08-10  

---

### Decision 1: EVM Scheme & Facilitator Driver Integration
- **Decision**: Use `@x402/evm/exact/server` (`ExactEvmScheme`) for Base L2 (`eip155:8453`), Arbitrum One (`eip155:42161`), and Ethereum L1 (`eip155:1`), bound to `HTTPFacilitatorClient` (`https://facilitator.goplausible.xyz`).
- **Rationale**: GoPlausible Facilitator handles EIP-3009 (`transferWithAuthorization`) permit validation and transaction relaying, avoiding operator gas liquidity management across EVM chains.
- **Alternatives Considered**: Direct viem/ethers gas relayer setup (rejected due to high operator native gas liquidity overhead across 4+ EVM chains).

### Decision 2: Solana SVM Signature Verification Strategy
- **Decision**: Require client to submit pre-broadcasted base58 transaction signature hash in `PAYMENT-SIGNATURE`, verified via Solana RPC (`@solana/web3.js` / `@x402/svm`) at `confirmed` commitment for USDC mint (`EPjFWdd5...`), escrow ATA recipient, and exact atomic microUSDC amount.
- **Rationale**: Eliminates gateway fee-payer liability on Solana while leveraging Solana's sub-second confirmation speed.
- **Alternatives Considered**: Gasless SVM transaction relaying (rejected due to fee payer rent-exempt ATA initialization and blockhash expiration complexity).

### Decision 3: Facilitator Downtime (5xx) Fallback & Circuit Breaker
- **Decision**: Direct RPC fallback verifies pre-submitted on-chain transaction proofs (Solana, Algorand, L1); gasless EIP-3009 permits fail-fast via Circuit Breaker (`503 Service Unavailable`) to prevent pinning un-settled payloads.
- **Rationale**: Complies strictly with Constitution Section I.5 (Queue Hardening & Circuit Breaker) to prevent accepting unpaid pinning requests during facilitator outages.
- **Alternatives Considered**: In-memory deferred settlement queue (rejected due to financial risk of un-collectable EIP-3009 signatures).
