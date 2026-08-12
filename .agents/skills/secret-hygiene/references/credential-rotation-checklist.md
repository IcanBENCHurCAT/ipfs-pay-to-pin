# Credential Rotation Checklist

Before you change any code, rotate every exposed credential at its provider. Old values remain active until rotated.

## Supabase

1. Go to <https://supabase.com/dashboard/project/_/settings/database>
2. Generate a new URL (Settings → Database → Connection string → Regenerate)
3. If PostgreSQL role passwords are exposed: Settings → Database → Roles → regenerate password
4. If service_role key is exposed: Settings → API → regenerate secret key
5. Update all services that use the old credentials with new values
6. Kill/redeploy running services

## AWS

1. AWS Console → IAM → Users → your-user → Security credentials
2. Access Keys → Create new key (keep old key active during transition if possible)
3. Update all services/configs with new credentials
4. Delete old key once verified working

## GoDaddy

1. GoDaddy Account → API Settings → Regenerate API key & certificate
2. Update DNS provider configurations

## Pinata

1. Pinata Dashboard → API Keys → Regenerate key
2. Update any services using Pinata for IPFS pinning

## DuckDNS

1. DuckDNS account → regenerate token
2. Update any services using the old token

## Algorand / Faucet

1. If private keys are exposed: create a new account, transfer funds, discard old account
2. If faucet keys are exposed: generate new keys via Algorand SDK

## General Steps

- [ ] List every credential exposed (from the git history manifest)
- [ ] Rotate each at its provider
- [ ] Verify each new credential works
- [ ] Update code/config files with `process.env.VAR_NAME` pattern
- [ ] Deploy updated code
- [ ] Test that everything works with new credentials

## Warning

- **Never commit new credentials either.** Use environment variables or secret managers.
- **Old credentials may still work** on services that haven't been redeployed. Rotate on a schedule.
- **If credentials were in public commits**: assume ALL services that consumed them are compromised. Rotate everything.
