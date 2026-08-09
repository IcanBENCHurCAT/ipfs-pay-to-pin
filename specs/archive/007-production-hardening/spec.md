# Feature Specification: Production Containerization & Queue Hardening

**Feature Branch**: `007-production-hardening`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Deploy to free tier hosting (OCI Always Free) with DuckDNS and automated Let's Encrypt SSL, containerize application with multi-stage Docker build & Caddy reverse proxy, and harden queue persistence and expiration handling for long-term stability."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Containerized Production Deployment & Automated SSL (Priority: P1)

As an operator running the IPFS Pay-to-Pin Gateway, I want to deploy the application on a free-tier virtual machine using standard Docker containers and automatic DuckDNS Let's Encrypt SSL certificates, so that the service runs 24/7 with zero hosting costs and full HTTPS security.

**Why this priority**: Heroku free tier retirement makes persistent, low-cost Docker deployment critical for continuous availability.

**Independent Test**: Can be tested by running `docker compose up -d` on a server with DuckDNS configured, verifying HTTP requests to the public domain automatically redirect to HTTPS with a valid Let's Encrypt TLS certificate.

**Acceptance Scenarios**:

1. **Given** a server with Docker and `docker-compose.yml`, **When** the service starts up, **Then** Caddy automatically obtains a Let's Encrypt SSL certificate for the configured DuckDNS domain and proxies traffic to the app on port 4021.
2. **Given** an incoming HTTP request on port 80, **When** hit by any client, **Then** Caddy redirects the client to port 443 HTTPS seamlessly.

---

### User Story 2 - Atomic Queue File Persistence (Priority: P2)

As a gateway client uploading files, I want upload queue metadata and disk buffers to be saved atomically and isolated across volume restarts, so that my microUSDC paid uploads are never lost due to memory race conditions or server restarts.

**Why this priority**: Race conditions or ephemeral container restarts can drop paid file pins.

**Independent Test**: Can be tested by running concurrent file pinning requests and forcing a process restart mid-queue to verify that all registry entries survive corruption-free.

**Acceptance Scenarios**:

1. **Given** multiple concurrent pin requests, **When** queue state is saved, **Then** file writes use atomic write-to-temporary and rename operations to prevent file corruption.
2. **Given** a container restart, **When** persistent volumes are mounted, **Then** all pending upload payloads in the queue survive intact.

---

### User Story 3 - Deterministic Expired Pin Retention Status (Priority: P3)

As an API consumer checking or renewing an expired file pin, I want to receive a consistent HTTP 410 Gone status code regardless of background cleanup timing, so that client integrations have predictable retention error handling.

**Why this priority**: Inconsistent status codes (404 vs 410) break client SDK expectation logic.

**Independent Test**: Can be tested by querying `/api/v1/renew` for a file that expired past its 30-day grace period both before and after the background cleanup task runs.

**Acceptance Scenarios**:

1. **Given** a CID whose expiration date + 30-day grace period has passed, **When** queried via `/api/v1/renew` before background cleanup, **Then** the server responds with HTTP 410 Gone.
2. **Given** a CID whose expiration date + 30-day grace period has passed, **When** queried via `/api/v1/renew` after background cleanup has completed, **Then** the server still responds with HTTP 410 Gone.

---

### Edge Cases

- What happens if the DuckDNS API is temporarily unreachable during startup? Caddy retries ACME verification automatically using stored account keys without failing standard container boot.
- What happens if an upload binary `.bin` file disappears from local disk before pinning? The worker marks the item as permanently failed and emits a structured error log.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a multi-stage `Dockerfile` that compiles TypeScript source into production JavaScript and runs under Node.js 20 Alpine.
- **FR-002**: System MUST provide a `docker-compose.yml` orchestrating the app container, Caddy reverse proxy, and DuckDNS auto-updater container with named volume persistence for `/app/queue`.
- **FR-003**: System MUST execute a root `"build": "tsc"` script in `package.json` for clean CI build verification.
- **FR-004**: System MUST perform atomic file writes (`write-to-tmp` + `rename`) when saving queue state to `registry.json` to prevent race condition corruption.
- **FR-005**: System MUST return HTTP 410 Gone deterministically for any pin renewal request targeting a CID whose retention grace period has expired, regardless of queue item status state.

### Key Entities

- **Docker Container Stack**: Production deployment units (App, Caddy, DuckDNS updater).
- **Persistent Volume Mount**: Storage path mapping host storage to `/app/queue` for binary payload survival.
- **Queue Registry**: State file (`registry.json` / Supabase `pin_records`) tracking pin item lifecycle and expiration dates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Single-command deployment (`docker compose up -d`) boots full application, Caddy TLS proxy, and DuckDNS updater in under 60 seconds.
- **SC-002**: Zero data loss or file corruption in `registry.json` during 100 concurrent pin requests.
- **SC-003**: 100% of expired pin renewal requests respond with HTTP 410 Gone regardless of background task execution timing.

## Assumptions

- Hosting target is a Linux virtual machine (e.g. Oracle Cloud Always Free ARM instance) with Docker and Docker Compose installed.
- DuckDNS subdomain and API token are provided via standard environment variables (`DUCKDNS_SUBDOMAIN`, `DUCKDNS_TOKEN`).
