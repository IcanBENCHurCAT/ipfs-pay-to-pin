# Quickstart & Deployment Validation Guide

## Local Build & Test Validation

### 1. TypeScript Build Test
Verify clean TypeScript compilation:
```bash
pnpm run build
```
*Expected Result*: Output compiled JS files to `dist/` without compilation errors.

### 2. Docker Container Stack Build
Build the multi-stage Docker image locally:
```bash
docker build -t ipfs-pay-to-pin:latest .
```
*Expected Result*: Multi-stage build succeeds; runner container size ~150MB.

### 3. Docker Compose Stack Launch
Launch application, Caddy, and DuckDNS services:
```bash
docker compose up -d
```
*Expected Result*: All 3 containers report `Up` status in `docker compose ps`.

---

## Production Deployment (Oracle Cloud Free Tier / VPS)

### 1. Prerequisites
- Linux VM with Docker and Docker Compose installed.
- Inbound ports 80 and 443 opened in network security rules / ufw firewall.
- DuckDNS account created with a subdomain token.

### 2. Deployment Commands
```bash
git clone https://github.com/IcanBENCHurCAT/ipfs-pay-to-pin.git
cd ipfs-pay-to-pin
cp .env.example .env
# Edit .env with your PINATA_JWT, ESCROW_ADDRESS, DUCKDNS_SUBDOMAIN, DUCKDNS_TOKEN
docker compose up -d
```

### 3. HTTPS Validation
```bash
curl -i https://<your-subdomain>.duckdns.org/health
```
*Expected Result*: HTTP 200 OK with valid Let's Encrypt TLS certificate.
