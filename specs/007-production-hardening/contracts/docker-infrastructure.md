# Docker Container Infrastructure Contract

## Compose Services Specification (`docker-compose.yml`)

### Service: `app`
- **Build Target**: Multi-stage `Dockerfile` (Node 20 Alpine)
- **Environment**: Injected from `.env` (`PORT`, `ALGORAND_NETWORK`, `PINATA_JWT`, `ESCROW_ADDRESS`, etc.)
- **Ports**: Internal container port 4021
- **Volumes**:
  - `queue_data:/app/queue` (Persists pending payload `.bin` files and `registry.json`)

### Service: `caddy`
- **Image**: `caddy:2-alpine`
- **Ports**:
  - `80:80` (HTTP challenge & HTTPS redirect)
  - `443:443` (HTTPS TLS proxying)
- **Volumes**:
  - `./Caddyfile:/etc/caddy/Caddyfile`
  - `caddy_data:/data`
  - `caddy_config:/config`
- **Depends On**: `app`

### Service: `duckdns`
- **Image**: `lscr.io/linuxserver/duckdns:latest`
- **Environment**:
  - `SUBDOMAINS=${DUCKDNS_SUBDOMAIN}`
  - `TOKEN=${DUCKDNS_TOKEN}`
  - `LOG_FILE=false`
