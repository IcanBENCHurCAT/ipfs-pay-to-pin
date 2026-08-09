# Phase 0: Outline & Research

## Technical Context & Technology Choices

- **Containerization Engine**: Docker & Docker Compose (`docker compose v2`).
- **Web Server / Reverse Proxy**: Caddy 2 Alpine (`caddy:2-alpine`).
  - *Rationale*: Caddy automatically handles Let's Encrypt / ZeroSSL ACME HTTP-01 challenges for HTTPS certificates on free domains like DuckDNS with zero manual certbot orchestration.
- **Dynamic DNS Provider**: DuckDNS (`lscr.io/linuxserver/duckdns`).
  - *Rationale*: Standard lightweight container that keeps DuckDNS subdomains pointing to the host's public IP address.
- **Runtime Environment**: Node.js 20 Alpine (`node:20-alpine`) using multi-stage build.
- **Queue Storage Persistence**: Named Docker volume `queue_data` mapped to `/app/queue` in container workspace.
- **State File Persistence**: Atomic file write pattern (`fs.writeFileSync(tmpPath)` + `fs.renameSync(tmpPath, targetPath)`).

## Research Decisions

### Decision 1: Reverse Proxy & Automated SSL
- **Choice**: Caddy 2.
- **Rationale**: Built-in automatic TLS certification via ACME (Let's Encrypt / ZeroSSL). Unlike NGINX, Caddy requires no external Certbot container or manual renewal scripts. It proxies external traffic on ports 80/443 directly to Node.js on internal port 4021.
- **Alternatives Considered**: NGINX + Certbot (higher complexity, requires shared volume for SSL certs), Traefik (overkill for single-node microservice).

### Decision 2: Ephemeral Disk Mitigation & Volume Persistence
- **Choice**: Named Docker volume (`queue_data`) bound to `/app/queue`.
- **Rationale**: Ensures buffered `.bin` payloads and local fallback `registry.json` survive container updates, restarts, and dyno reinstantiations.
- **Alternatives Considered**: Host folder bind mount (permission issues across Linux distributions), S3 staging (adds external cloud dependency and latency).

### Decision 3: Atomic State File Writes
- **Choice**: Write to temporary file (`queue/registry.json.tmp.<pid>.<uuid>`) then atomically rename over `queue/registry.json`.
- **Rationale**: Prevents partial file reads or JSON corruption when concurrent pin/renew operations update queue state. On POSIX and Windows filesystem abstractions, atomic rename guarantees writers never expose partially written bytes to readers.

### Decision 4: Deterministic HTTP 410 Expiration Response
- **Choice**: Update `findByCid()` in `src/queue.ts` / `src/db.ts` to return expired items regardless of status `'FAILED'`, allowing `/renew` endpoint logic to detect `isExpired(item)` and return `HTTP 410 Gone`.
- **Rationale**: Ensures consistent SDK/client error responses for expired pins independent of whether `processExpiredPins()` background task has executed.
