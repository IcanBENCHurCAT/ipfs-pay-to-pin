# IPFS Pay-to-Pin Infrastructure & CI/CD Secrets Reference

This document catalogs every repository secret and environment variable utilized by GitHub Actions and production deployment for **IPFS Pay-to-Pin**. **No secret values or credentials are stored in this document or in the repository.**

---

## 1. GitHub Actions Secrets Catalog

| Secret Name | Purpose | Source / Provisioning Mechanism |
|---|---|---|
| `DEPLOY_HOST` | Target host IP or DNS for production SSH deployment | Static Public IPv4 of target instance |
| `DEPLOY_USER` | Restricted SSH user on target instance | Dedicated deployer account (`ubuntu`) |
| `DEPLOY_SSH_KEY` | Ed25519 OpenSSH private key for SSH deployment access | Provisioned deploy keypair matching target VM authorized_keys |
| `DUCKDNS_SUBDOMAIN` | Subdomain slug for dynamic DNS routing (e.g. `pay-to-pin`) | [DuckDNS.org](https://www.duckdns.org) domain configuration |
| `DUCKDNS_TOKEN` | Token for dynamic DNS IP synchronization via DuckDNS API | [DuckDNS.org](https://www.duckdns.org) account management |
| `SUPABASE_URL` | Supabase project API endpoint for persistence | Supabase Project Settings &rarr; API |
| `SUPABASE_KEY` | Supabase service/anon API key for database transactions | Supabase Project Settings &rarr; API Keys |
| `ESCROW_ADDRESS` | Blockchain payment escrow wallet address | Configured payment receiver address |
| `EVM_ESCROW_ADDRESS` | EVM (Ethereum / Polygon / Arbitrum) payment address | Configured payment receiver address |
| `SOLANA_ESCROW_ADDRESS`| Solana payment receiver wallet address | Configured payment receiver address |
| `OCI_TENANCY_OCID` | Tenancy identifier for OCI API operations | OCI Console &rarr; Tenancy Details |
| `OCI_USER_OCID` | Dedicated CI/CD IAM service user OCID (`ci-deployer`) | OCI Console &rarr; Identity &rarr; Domains / Users |
| `OCI_FINGERPRINT` | Fingerprint of the API signing key for `ci-deployer` | Generated via `openssl rsa -pubout -outform DER \| openssl md5 -c` |
| `OCI_PRIVATE_KEY` | RSA Private Key (PEM format) for `ci-deployer` API requests | Dedicated CI deployer keypair (`~/.oci/ci_deployer_api_key.pem`) |
| `OCI_REGION` | Target OCI data center region (`us-ashburn-1`) | Tenancy home region |

---

## 2. GitHub Actions Repository Variables

| Variable Name | Purpose | Default / Values |
|---|---|---|
| `DEPLOY_PAUSED` | Emergency deploy killswitch. When `"true"`, deployment step aborts immediately. | `"false"` (or unset) |

---

## 3. Remote State Backend Parameters

| Component | Storage Type | Mechanism / Path |
|---|---|---|
| **Terraform Backend** | OCI Object Storage HTTP PAR | Pre-Authenticated Request (PUT/GET) to `bucket/terraform-remote-state/o/ipfs-pay-to-pin.tfstate` |
| **Deploy Pause Object** | OCI Object Storage Object Check | `bucket/terraform-remote-state/o/.deploy-pause` |
