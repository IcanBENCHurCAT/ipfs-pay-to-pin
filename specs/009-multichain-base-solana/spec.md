# Feature Specification: Multi-Chain Base & Solana Payment Expansion

**Feature Directory**: `specs/009-multichain-base-solana`  
**Status**: DRAFT  
**Created**: 2026-08-10  

---

## Executive Summary

Expand the IPFS Pay-to-Pin Gateway x402 payment interface to accept multi-chain microUSDC payments on Base L2 (`eip155:8453`), Solana Mainnet (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`), and Ethereum L1 (`eip155:1`) alongside existing Algorand Mainnet (`algorand:mainnet`) options. EVM micropayments utilize EIP-3009 (`transferWithAuthorization`) gasless permits and GoPlausible facilitator rails, eliminating native gas requirements for clients and shielding gateway operations from EVM gas price volatility.

---

## Clarifications

### Session 2026-08-10
- Q: For Solana SPL USDC payments, how is `PAYMENT-SIGNATURE` structured and verified? → A: Require clients to submit pre-broadcasted base58 transaction signature hashes in `PAYMENT-SIGNATURE`, verified against Solana RPC at `confirmed` commitment for USDC mint (`EPjFWdd5...`), escrow recipient ATA, and exact microUSDC amount.
- Q: How does the gateway handle GoPlausible Facilitator 5xx downtime? → A: Direct RPC fallback is used for pre-submitted on-chain transaction proofs (Solana, Algorand, L1); gasless EIP-3009 permits fail-fast via Circuit Breaker (`503 Service Unavailable`) to prevent pinning un-settled payloads.

---

## User Scenarios & Acceptance Criteria

### Scenario 1: Base L2 Gasless USDC Pinning Flow (EVM Priority Rail)
- **Given** an unauthenticated client or autonomous AI agent making a `POST /api/v1/pin` request with a Base64 file payload.
- **When** the gateway returns an HTTP `402 Payment Required` challenge.
- **Then** the `PAYMENT-REQUIRED` response header MUST contain standard CAIP-2 network options including Base (`eip155:8453`) with `eip3009: true`.
- **And** when the client submits an off-chain signed EIP-3009 `transferWithAuthorization` payload in the `PAYMENT-SIGNATURE` header, the gateway MUST verify the authorization via GoPlausible facilitator, buffer the payload, and return `201 Created` with a 365-day pin expiration metadata response.

### Scenario 2: Solana SPL USDC Pinning Flow (SVM Rail)
- **Given** a client targeting Solana Mainnet (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`).
- **When** the client selects the Solana network option from the x402 `accepts[]` array and submits an already-broadcasted base58 transaction signature hash in `PAYMENT-SIGNATURE`.
- **Then** the gateway MUST verify the Solana transaction signature on-chain via GoPlausible facilitator or fallback Solana RPC (`confirmed` commitment level), validating correct USDC mint (`EPjFWdd5...`), escrow recipient Associated Token Account (ATA), and amount before returning `201 Created`.

### Scenario 3: Ethereum L1 Surcharge & Volatility Protection Flow
- **Given** a client choosing to settle on Ethereum L1 (`eip155:1`).
- **When** the gateway generates the L1 payment option in the `accepts[]` array.
- **Then** the gateway MUST dynamically apply an L1 gas surcharge floor ($2.50–$15.00) and enforce a short quote expiration TTL (90 seconds).
- **And** if the quote expires before the client submits payment, the gateway MUST reject the signature with HTTP 402 detailing quote expiration and immediately attach a fresh `PAYMENT-REQUIRED` challenge with updated quote pricing.

---

## Functional Requirements

1. **CAIP-2 Header Multi-Chain Specification**:
   - The gateway MUST format `PAYMENT-REQUIRED` header challenge payloads with an `accepts[]` array listing network CAIP-2 identifiers:
     - `eip155:8453` (Base L2)
     - `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` (Solana Mainnet)
     - `algorand:mainnet` (Algorand Mainnet)
     - `eip155:1` (Ethereum L1)
2. **GoPlausible Facilitator & Fallback Integration**:
   - The Hono server MUST register EVM (`ExactEvmScheme`), SVM (`ExactSvmScheme`), and AVM (`ExactAvmScheme`) drivers bound to `HTTPFacilitatorClient`.
   - On Facilitator 5xx failure, direct RPC fallback MUST verify pre-submitted Solana/Algorand transactions, while EIP-3009 permits fail-fast via Circuit Breaker (`503 Service Unavailable`).
3. **Replay Protection & Database Schema**:
   - The persistence layer (Supabase PostgreSQL and local `registry.json` fallback) MUST store `payment_network`, `tx_hash`, `token_address`, `payer_address`, `amount_paid`, and `settlement_status`.
   - The database MUST enforce a composite unique constraint/index on `(payment_network, tx_hash)` to prevent cross-chain transaction replay attacks.
4. **Circuit Breaker & Queue Safety**:
   - The circuit breaker middleware MUST continue to intercept requests and return `503 Service Unavailable` if the local queue is full, ensuring clients are never prompted for multi-chain payment when buffer space is exhausted.

---

## Success Criteria

- **Multi-Chain Coverage**: Clients can successfully authenticate and pin files using Base L2 USDC, Solana SPL USDC, Algorand microUSDC, or Ethereum L1 USDC.
- **Zero Client Gas Requirement on Base**: 100% of Base L2 USDC payments execute gaslessly for the client via EIP-3009 authorizations.
- **Replay Immunity**: Duplicate `(payment_network, tx_hash)` submissions across any chain are rejected instantly with an explicit HTTP 400/409 payment error.
- **Uptime & Latency**: Payment verification and local buffering complete within <1.0 second across all supported chains under standard network conditions.

---

## Assumptions & Bounded Scope

- **Facilitator Dependency**: Primary verification and settlement relaying relies on GoPlausible Facilitator (`FACILITATOR_URL`), with direct RPC verification fallback for on-chain proofs.
- **MicroUSDC Standard**: All assets (USDC ERC-20 on Base/L1, SPL USDC on Solana, ASA 31566704 on Algorand) use 6 decimals (1 USDC = 1,000,000 atomic units).
- **Out of Scope**: Native token payments (ETH, SOL, ALGO) are out of scope; only USD-denominated stablecoin (USDC) payments are accepted.
