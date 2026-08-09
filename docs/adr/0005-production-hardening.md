# v0005: Production Containerization & Queue Hardening

This document details the architectural decisions made during the implementation of the Production Containerization & Queue Hardening feature.

---

## Status
Approved / Implemented

## Context & Problem
Retiring legacy single-container hosts (such as Heroku free dynos) required establishing a self-hosted, multi-container architecture for zero-cost deployment on Linux virtual machines (e.g., Oracle Cloud Infrastructure Always Free VM). Furthermore, state persistence needed hardening against race conditions and ephemeral disk wipes so that microUSDC paid uploads remain safe across container restarts and high concurrent load.

## Decision
1. **Multi-Stage Build**: Implemented a multi-stage `Dockerfile` (Node 20 Alpine) using `pnpm` that compiles TypeScript source to `dist/` and runs a minimal production runner container (~150MB footprint).
2. **Reverse Proxy & Auto-TLS**: Deployed Caddy 2 (`caddy:2-alpine`) in front of the application on ports 80/443. Caddy automatically provisions and renews Let's Encrypt / ZeroSSL TLS certificates for the registered DuckDNS subdomain (`pay-to-pin.duckdns.org`).
3. **Container Orchestration**: Created `docker-compose.yml` orchestrating `app`, `caddy`, and `duckdns` auto-updater containers with named Docker volume persistence (`queue_data`) bound to `/app/queue`.
4. **Atomic File Write Hardening**: Updated `DbManager.saveItems()` in `src/db.ts` to write to a temporary file (`.tmp`) before synchronously renaming over `registry.json` to eliminate state file corruption during concurrent operations.

## Consequences
- **Positive**: 1-command deployment (`docker compose up -d`) provides permanent 24/7 HTTPS microservice execution at $0/month.
- **Positive**: Queue payloads and metadata persist reliably across container reinstantiations and system reboots.
- **Negative**: Self-hosted VPS instances require open inbound ports 80 and 443 in host firewall/network security rules.

## Superseded Decisions
None. Extends ADR 0001 and ADR 0004 for containerized VPS infrastructure.
