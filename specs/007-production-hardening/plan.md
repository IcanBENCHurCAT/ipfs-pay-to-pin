# Implementation Plan: Production Containerization & Queue Hardening

**User Spec**: [`spec.md`](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/007-production-hardening/spec.md)  
**Feature Branch**: `007-production-hardening`  
**Created**: 2026-08-05  

---

## Technical Context

- **Node.js**: 20 Alpine (`node:20-alpine`) multi-stage Docker runtime.
- **Package Manager**: `pnpm` (workspace enabled).
- **Reverse Proxy**: Caddy 2 (`caddy:2-alpine`) for automatic Let's Encrypt TLS.
- **DNS Auto-Updater**: DuckDNS container (`lscr.io/linuxserver/duckdns`).
- **Data Persistence**: Named Docker volume (`queue_data`) + atomic file write (`.tmp` + `rename`).

---

## Constitution Check

- [x] **Legal & Content Safety**: Preserves existing file size and content type validations.
- [x] **Smart Contract Correctness**: No changes to `escrow/contract.py` or Puya compilation.
- [x] **x402 Compliance**: `@x402/hono` middleware protocol maintained without alteration.
- [x] **Fault Tolerance & Reliability**: Adds persistent volume mounts for local queue buffer and implements atomic file writes to protect state from race condition corruption.
- [x] **Retention Expiration**: Hardens `/renew` endpoint status code handling to guarantee `410 Gone` for expired pins.

---

## Proposed Changes

### Build Infrastructure & Packaging

#### [MODIFY] [`package.json`](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/package.json)
- Add root `"build": "tsc"` script so TypeScript source compiles cleanly to `dist/`.

#### [NEW] [`Dockerfile`](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/Dockerfile)
- Multi-stage Docker build (`builder` -> `runner`) using `node:20-alpine` and `pnpm`.

#### [NEW] [`docker-compose.yml`](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/docker-compose.yml)
- Compose stack orchestrating `app`, `caddy`, and `duckdns` services with volume persistence.

#### [NEW] [`Caddyfile`](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/Caddyfile)
- Reverse proxy config directing external domain traffic to `app:4021` with automatic HTTPS.

---

### Backend Quality & Queue Hardening

#### [MODIFY] [`src/queue.ts`](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/src/queue.ts)
- Implement atomic file replacement (`write-to-tmp` + `renameSync`) when persisting state to `registry.json`.
- Standardize expired item query filtering so `/renew` deterministically returns `410 Gone` for expired CIDs.

---

## Verification Plan

### Automated Tests
- Run `pnpm run build` to verify clean TypeScript compilation.
- Run `pnpm test` to verify existing test suite passes.

### Manual Verification
- Test Docker image build via `docker build -t ipfs-pay-to-pin:latest .`.
- Test Docker Compose stack launch via `docker compose up -d`.
