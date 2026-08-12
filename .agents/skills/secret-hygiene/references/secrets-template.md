# SECRETS.md — Credential Inventory

## Purpose

Document all credentials the project uses, where they're stored, and who manages them. This is the single source of truth for credential awareness.

## How to Use

When a new credential is added (API key, database URL, token, etc.):
1. Add it to the table below
2. Note where it's stored (env var, secret manager, config file)
3. Note the owner/contact
4. Note rotation schedule

## Credential Inventory

| Credential | Purpose | Storage Location | Owner | Rotation Schedule |
|------------|---------|-----------------|-------|-------------------|
| e.g., Supabase URL | Database access | `.env.production` on server | @maintainer | After breach or quarterly |
| e.g., Pinata JWT | IPFS pinning | Server env var | @maintainer | Quarterly |
| e.g., Algorand address | Blockchain payments | `.env.production` | @maintainer | When key exposed |
| e.g., DuckDNS token | DNS updates | Server env var | @maintainer | After breach |

## Secret Managers (if used)

| System | What it stores | Provider |
|--------|---------------|----------|
| e.g., AWS Secrets Manager | Supabase password | AWS |
| e.g., Docker secrets | API keys | Docker swarm |

## Exposed Credentials History

| Date | Credential | How exposed | Status |
|------|-----------|-------------|--------|
| YYYY-MM-DD | Supabase URL | Committed to .env.example | Rotated |
| YYYY-MM-DD | JWT token | Committed to src/config.ts | Rotated |

## Rules

1. Never commit real credentials — use `.env` files that are gitignored
2. .example/.env.example files MUST use placeholder values only
3. This file must be updated whenever a new credential is added
4. This file is NOT a secret — it documents what credentials exist, not their values
