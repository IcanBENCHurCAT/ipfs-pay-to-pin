# Credentials Inventory

> ⚠️ **This file documents WHAT credentials the project uses — NOT their values.**
> Never commit actual credential values in this file.

## Credentials Used by This Project

| Credential | Purpose | Where Stored | Rotation Policy |
|-----------|---------|-------------|-----------------|
| `SUPABASE_URL` | Supabase PostgreSQL project URL | `.env`, Heroku config vars | When key is rotated |
| `SUPABASE_KEY` | Supabase anon API key | `.env`, Heroku config vars | Every 90 days |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin API key | `.env`, Heroku config vars | Every 90 days |
| `SUPABASE_DATABASE_URL` | PostgreSQL connection string | `.env` (local dev only) | When DB password rotates |
| `PINATA_JWT` | Pinata IPFS pinning JWT | `.env`, Heroku config vars | Every 180 days |
| `DUCKDNS_TOKEN` | DuckDNS subdomain update token | `.env` (deployment only) | When compromised |
| `ALGORAND_NETWORK` | Algorand network selection | Env var, not a secret | N/A |
| `ALGORAND_SERVER` | Algorand node endpoint | Env var, not a secret | N/A |
| `ESCROW_ADDRESS` | Algorand escrow contract | Public blockchain — not secret | N/A |

## Where Credentials Are Stored

### Safe locations (✅)

- **`.env`** — Local development, gitignored
- **Heroku Config Vars** — Production deployment
- **GitHub Actions Secrets** — CI/CD pipeline
- **Terraform `terraform.tfvars`** — Infrastructure (gitignored)

### UNSAFE locations (❌ NEVER)

- **Source code** — No hardcoded credentials in `.ts`, `.js`, `.py`, etc.
- **Example files** — `*.example`, `README.md` must use placeholders only
- **Comments in code** — Even commented-out credentials are risky
- **`.git/config`** — Never store credentials here

## Rotation Procedures

When a credential needs rotation:

1. **Create the new credential** in the provider dashboard
2. **Update the deployment config** (Heroku, Terraform, etc.)
3. **Update `.env`** for local development
4. **Remove old credential from `.env.bak`** if it exists
5. **Do NOT force-push** — old commits with credentials remain public; the fix is that new commits use env vars
6. **Document the rotation** in daily memory

## Credential Detection

All commits are scanned by the pre-commit hook (`.git/hooks/pre-commit`). If a credential is detected:

- The commit is **blocked** with a clear error message
- The file and line number are reported
- A fix hint is provided (use `process.env.VAR` instead)

To bypass: `git commit --no-verify` — **but don't do this unless you have a good reason.**
