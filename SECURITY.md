# Security

## Reporting Vulnerabilities

If you discover a security vulnerability in this project, please disclose it responsibly.

### What to include

1. **Description** of the vulnerability (be specific)
2. **Reproduction steps** if possible
3. **Impact assessment** (what could an attacker do?)

### What to expect

1. **Acknowledgment** within 48 hours
2. **Status updates** every 7 days
3. **Fix timeline** — critical vulnerabilities are patched immediately
4. **Credit** in release notes (unless you prefer anonymity)

### Security best practices for contributors

- **Never commit real credentials** — use environment variables or `.env` files (gitignored)
- **Example files must use placeholders** — `your-project.supabase.co`, not real project URLs
- **Run `git diff --cached` before committing** — always double-check what you're staging
- **Use `git restore --staged <file>`** to unstage accidentally committed secrets

---

## Credential Policy

### What must NEVER appear in the repo

| Type | Examples |
|------|----------|
| API keys | `eyJhbGciOiJIUzI1NiJ...`, `sk-...`, `pk_live_...` |
| Database URLs | `postgresql://user:pass@host:port/db` |
| Project URLs | `https://*.supabase.co`, `https://*.algolia.net` |
| Tokens | UUIDs that are tokens (not public UUIDs) |
| Private keys | RSA/EC/EdDSA private key material |

### What MUST appear in example files

| Type | Example |
|------|---------|
| Database URL | `postgresql://user:your_password@localhost:5432/mydb` |
| API keys | `your_api_key_here` |
| Project URLs | `https://your-project.supabase.co` |

### What to use instead of hardcoded credentials

- **Development**: `.env` file (gitignored) → `process.env.VAR`
- **Production**: Environment variables via deployment config (Terraform, Heroku vars, etc.)
- **CI/CD**: GitHub Actions secrets → `${{ secrets.VAR }}`
- **Shared config**: `.env.example` with ONLY placeholder values

---

## Postmortem

See [POSTMORTEM_SUPABASE_LEAK.md](./POSTMORTEM_SUPABASE_LEAK.md) for the most recent credential leak postmortem and the no-repeat prevention plan.
