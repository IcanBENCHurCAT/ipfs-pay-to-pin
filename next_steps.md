# IPFS Pay-to-Pin Gateway Next Steps & Epics

This document tracks the epics, user stories, and specs required to take the IPFS Pay-to-Pin Gateway all the way to production.

---

## Batch 1: Core Escrow Smart Contract & Mock Verification

- [x] **AB-PP-001: Pricing & Configuration Contract**
  * As a gateway operator, I want to deploy an Algorand smart contract (`algopy`) that securely manages base-price and per-byte pricing, so that my service fee structure is on-chain, auditable, and easily adjustable.
- [ ] **AB-PP-002: x402 Dynamic Payment Challenge & Local Verification**
  * As a client application, I want to upload a file to the gateway, receive a standard HTTP 402 challenge with size-calculated fees, and submit an on-chain transaction reference to verify and complete my file write, so that I pay exactly for the resources I use.
- [ ] **AB-PP-003: Pluggable Storage & Mock Adapter**
  * As a test suite runner, I want a pluggable storage interface with a local file storage mock, so that I can test the API and client flows without active cloud credentials or network latency.

---

## Batch 2: Integrations & Production Clients

- [ ] **AB-PP-004: Pinata IPFS Pinning Integration**
  * As a Web3 gateway operator, I want my storage adapter to forward uploads to Pinata's API, so that verified files are permanently pinned to the decentralized IPFS network.
- [ ] **AB-PP-005: Production Chain Verification Indexer**
  * As a production gateway host, I want the transaction verification indexer to query live testnet/mainnet node providers (via `algokit-utils`), handle block latency, and double-check transaction notes, so that I prevent double-spend or spoofed payment bypasses.
- [ ] **AB-PP-006: GCS Storage Adapter Option**
  * As a private enterprise gateway operator, I want the option to configure Google Cloud Storage as the storage backend instead of IPFS, so that I can run a highly cost-effective, centralized storage fallback.

---

## Batch 3: Turnkey Deployment & SDKs

- [ ] **AB-PP-007: Docker Compose & Deployment Automation**
  * As a system administrator, I want a single-command Docker Compose setup that spins up the FastAPI app, compiles the contract, and exposes the gateway, so that deployment onto cloud hosts is turnkey and automated.
- [ ] **AB-PP-008: Client SDK & CLI Integration**
  * As an application developer, I want a lightweight Python library or CLI client that automates the `POST file -> Sign x402 transaction -> POST verification -> Receive CID` lifecycle, so that I can integrate pay-per-request storage in less than 5 lines of code.
