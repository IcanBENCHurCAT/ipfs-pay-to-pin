# Secrets Directory & Provenance

This document lists all secrets configured for automated CI/CD and deployment across `IcanBENCHurCAT/inkpanel` and `IcanBENCHurCAT/ipfs-pay-to-pin`. In accordance with security policy, **no secret values are contained in this document or committed to git**.

---

## 1. OCI IAM & CI/CD Secrets (Both Repositories)

| Secret Name | Purpose | Provenance / Origin |
|---|---|---|
| `OCI_USER_OCID` | OCID of dedicated `ci-deployer` service account | OCI IAM Console -> Identity -> Users -> `ci-deployer` |
| `OCI_TENANCY_OCID` | Root tenancy identifier | OCI Tenancy details (`~/.oci/config`) |
| `OCI_FINGERPRINT` | Fingerprint of RSA API key uploaded to `ci-deployer` | OCI IAM API Keys for `ci-deployer` |
| `OCI_PRIVATE_KEY` | Private RSA key for OCI CLI / Terraform API calls | Generated locally during CI bootstrap; stored exclusively in GitHub Secrets |
| `OCI_REGION` | Tenancy region (`us-ashburn-1`) | OCI tenancy configuration |
| `DEPLOY_HOST` | Target IP address of the deployment host | Terraform output (`edge_public_ip` or `apps_public_ip`) |
| `DEPLOY_USER` | Dedicated restricted deploy user on VM | Created by cloud-init (`deployer`) |
| `DEPLOY_SSH_KEY` | Private ed25519 SSH deploy key | Generated during bootstrap; public key injected into VM cloud-init |

---

## 2. InkPanel Application Secrets (`IcanBENCHurCAT/inkpanel`)

| Secret Name | Purpose | Provenance / Origin |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini LLM API key | Google AI Studio |
| `GROQ_API_KEY` | Groq LLM API key | Groq Console |
| `OPENROUTER_API_KEY` | OpenRouter multi-model LLM API key | OpenRouter Dashboard |
| `INKPANEL_INVITE_CODE` | Registration gate invite code | InkPanel administrative configuration |
| `DUCKDNS_TOKEN` | DuckDNS Dynamic DNS updater token | DuckDNS Account |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID for user login | Google Cloud Console -> Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret | Google Cloud Console -> Credentials |
| `INKPANEL_GITHUB_CLIENT_ID` | GitHub OAuth Client ID for user login | GitHub Developer Settings -> OAuth Apps |
| `INKPANEL_GITHUB_CLIENT_SECRET`| GitHub OAuth Client Secret | GitHub Developer Settings -> OAuth Apps |

---

## 3. IPFS Pay-to-Pin Application Secrets (`IcanBENCHurCAT/ipfs-pay-to-pin`)

| Secret Name | Purpose | Provenance / Origin |
|---|---|---|
| `ESCROW_ADDRESS` | Algorand on-chain payment escrow wallet | Algorand wallet address |
| `EVM_ESCROW_ADDRESS` | EVM on-chain payment escrow wallet | EVM wallet address |
| `SOLANA_ESCROW_ADDRESS` | Solana on-chain payment escrow wallet | Solana wallet address |
| `SUPABASE_URL` | Supabase Postgres/Database endpoint | Supabase Project Settings |
| `SUPABASE_KEY` | Supabase Service Role API Key | Supabase Project Settings -> API |
| `DUCKDNS_TOKEN` | DuckDNS Dynamic DNS updater token | DuckDNS Account |
| `DUCKDNS_SUBDOMAIN` | Subdomain for DuckDNS (`pay-to-pin`) | DuckDNS Account |

---

## 4. Key Rotation Protocol

1. **OCI API Key**: Generate new RSA 2048 key, upload public key to `ci-deployer` in OCI IAM, update `OCI_PRIVATE_KEY` and `OCI_FINGERPRINT` via `gh secret set`, delete old key in OCI IAM.
2. **SSH Deploy Key**: Generate new ed25519 key, update `~deployer/.ssh/authorized_keys` on VM, update `DEPLOY_SSH_KEY` via `gh secret set`.
3. **Application Tokens**: Update in upstream provider, run `gh secret set <NAME>`, trigger deployment on `main`.
