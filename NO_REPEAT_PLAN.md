# No-Repeat Plan: Preventing Secret Leaks in ipfs-pay-to-pin

**Date:** 2026-08-11
**Based on:** Postmortem POSTMORTEM_SUPABASE_LEAK.md

---

## Goal

Ensure that production credentials (Supabase keys, JWT tokens, connection strings, API keys) **never** appear in the public repository — in source code, example files, or git history — and that any accidental introduction is blocked before it reaches `main`.

---

## Layer 1: Prevention (Blocks leaks at commit time)

### 1.1 Pre-commit Hook: gitleaks

**Action:** Install and configure `gitleaks` as a pre-commit hook.

**Why gitleaks over git-secrets?**
- gitleaks has more comprehensive detection rules (Supabase URLs, JWT patterns, connection strings)
- Actively maintained, widely adopted
- Can run in detect mode (pre-commit) and audit mode (CI)

**Implementation:**
```bash
# Install gitleaks
npm install -D gitleaks

# Create .gitleaks.toml with project-specific rules
# Add pre-commit hook that runs `npx gitleaks detect`
```

### 1.2 Pre-commit Hook: Custom Secret Detector

**Action:** Add a lightweight pre-commit hook that checks for common patterns gitleaks might miss.

**Patterns to block:**
- `https://*.supabase.co` (any Supabase project URL)
- `eyJhbGciOiJIUzI1NiJ` (JWT tokens in code, not just comments)
- `postgresql://postgres.*.supabase.com` (connection strings)
- `ALGORAND_.*_SERVER=https://mainnet` (production endpoints with env var patterns)
- `DUCKDNS_TOKEN=` followed by non-placeholder values

### 1.3 Pre-commit Hook: Example File Validator

**Action:** Add a hook that validates `*.example` files cannot contain real infrastructure values.

**Rule:** All example files must use clearly fake placeholders:
- URLs: `https://your-project.supabase.co` ✅ | `https://gtcguonqciokigxlvfyq.supabase.co` ❌
- Keys: `your_key_here` ✅ | `eyJhbGciOi...` ❌
- Subdomains: `your-domain` ✅ | `pay-to-pin` ❌

### 1.4 Lockfile Sync Protocol (Preventing `ERR_PNPM_OUTDATED_LOCKFILE`)

**Why `ERR_PNPM_OUTDATED_LOCKFILE` Happens:**
When a dependency (e.g. `@x402/evm` or `@x402/svm`) is added to `package.json` or `sdk/package.json` using `npm install` or manual edits instead of `pnpm install`, `package.json` specifiers drift from `pnpm-lock.yaml`. GitHub Actions CI defaults to `pnpm install --frozen-lockfile` and fails build checks.

**No-Repeat Rules:**
1. **Always run lockfile update after dependency edits**: Whenever `package.json` dependencies change, execute:
   ```bash
   npx pnpm install --no-frozen-lockfile
   ```
2. **Automated Pre-commit Lockfile Verification**:
   Add a pre-commit check (`.githooks/pre-commit`) that validates `pnpm-lock.yaml` is completely synchronized with `package.json` prior to committing code.

---

## Layer 2: CI Detection (Catches what pre-commit misses)

### 2.1 gitleaks in CI

**Action:** Add a CI step that runs `gitleaks protect` on every PR before merge.

**Implementation:**
```yaml
# .github/workflows/security.yml (new)
name: Security Scan
on: [push, pull_request]
jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # needed for full history scan
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2.2 Periodic Full-Repo Scan

**Action:** Add a scheduled GitHub Action that scans the entire repo weekly, including all branches and tags.

---

## Layer 3: Process (Human/Agent discipline)

### 3.1 Example File Policy

**Rule:** Example/template files (`.example`, `.template`, `.sample`, `README.md` config sections) must contain ONLY fake data.

**Template for example files:**
```
# Development example — DO NOT use real values here
API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:pass@localhost:5432/dev_db
SUPABASE_URL=https://your-project.supabase.co
```

**Review:** Every PR that modifies example files must be reviewed by another agent/person for accidental real values.

### 3.2 Credential Lifecycle Policy

**Rule:** When credentials rotate:
1. Old credentials are immediately gitignored (if accidentally committed)
2. New credentials go to `.env` (never to example files)
3. A `.env.bak` or migration script documents the rotation date
4. Old commits with credentials are NOT force-pushed (history stays public, new commits use env vars)

### 3.3 Multi-Agent Coordination

**Rule:** When multiple autonomous agents work on the same repo:
1. Before committing secrets, agents check `SECRETS.md` (a new doc listing what credentials exist)
2. After committing, agents run a post-commit scan
3. No agent hardcodes credentials as fallbacks — use `process.env.X || undefined` pattern

---

## Layer 4: Remediation (Fix the existing leak)

### 4.1 Immediate: Fix Current Leaks

Fix all files that still contain leaked credentials (see Postmortem Section 2.2):
- `scripts/test-supabase-select.ts` — Remove hardcoded URL
- `scripts/trigger-live-heroku-sweep.ts` — Remove fallback URL and JWT
- `scripts/test-supabase-expiration-sweeper.ts` — Remove fallback URL
- `terraform/terraform.tfvars.example` — Replace real URL/keys with placeholders
- `scripts/grant-supabase-permissions.ts` — Replace hardcoded connection string
- `scripts/reset-status-to-pinned.ts` — Replace hardcoded connection string

### 4.2 Credential Rotation

- [ ] Rotate Supabase anon key
- [ ] Rotate Supabase service-role key  
- [ ] Rotate PostgreSQL password
- [ ] Rotate DuckDNS token
- [ ] Rotate Pinata JWT

### 4.3 Git History Cleanup (Future)

- [ ] Use `git-filter-repo` to purge secrets from all commits
- [ ] Force-push to origin
- [ ] Invalidate all GitHub tokens that may have scanned the repo
- [ ] Update GitHub's secret scan index

**Note:** History cleanup is a best-effort operation. GitHub's cache may still contain leaked data for ~72 hours after force-push. **Prevention is the only guaranteed solution.**

---

## Implementation Checklist

| # | Action | Status |
|---|--------|--------|
| 1 | Write postmortem | ✅ Done |
| 2 | Write no-repeat plan | ✅ Done |
| 3 | Fix all current credential leaks in working tree | In Progress |
| 4 | Sanitize `terraform.tfvars.example` | In Progress |
| 5 | Create `.gitleaks.toml` with project-specific rules | Pending |
| 6 | Install gitleaks as pre-commit hook | Pending |
| 7 | Add `SECURITY.md` with vulnerability reporting | Pending |
| 8 | Add gitleaks to CI workflow | Pending |
| 9 | Create `SECRETS.md` inventory of credentials | Pending |
| 10 | Commit and push all fixes | Pending |

---

## Review Cadence

- **Monthly:** Run `gitleaks detect --no-git` on the full working tree
- **Quarterly:** Review and update `.gitleaks.toml` rules
- **After every secret exposure:** Update this plan with new findings

---

*No human or agent should ever need to manually "unleak" secrets again. The layers above are designed to make accidental leaks impossible, not just detectable after the fact.*
