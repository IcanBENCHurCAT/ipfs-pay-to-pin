# Postmortem: Supabase Credentials Exposed in ipfs-pay-to-pin

**Date:** 2026-08-11
**Severity:** HIGH — Production database credentials in public Git history
**Status:** Partially remediated (manual fixes only)

---

## 1. Executive Summary

Supabase production credentials (project URL, JWT tokens, and PostgreSQL connection strings) were committed to the `ipfs-pay-to-pin` repository in hardcoded form across multiple scripts and configuration files. The leak persisted for **~11 days** (July 31 – August 11, 2026) before being partially addressed by a Sentinel agent. Even after the "fix," several files still contain leaked credentials in fallback/default values.

**Impact:** Any GitHub user with access to the repo could connect to the Supabase project, read/modify `pin_records`, and potentially access associated infrastructure. The exposed PostgreSQL connection string also reveals the project's internal database hostname and authentication pattern.

---

## 2. What Happened

### 2.1 Timeline of Events

| Date | Event |
|------|-------|
| **Jul 31** | Scripts `test-supabase-expiration-sweeper.ts` and `trigger-live-heroku-sweep.ts` created with hardcoded Supabase URL fallback (`https://gtcguonqciokigxlvfyq.supabase.co`) |
| **Aug 8** | Sentinel agent #35 (`c4c9f3e`/`a5b344d`/`1c10dc3`) partially fixed hardcoded credentials in migration/automation scripts |
| **Aug 9** | Scripts `grant-supabase-permissions.ts`, `reset-status-to-pinned.ts`, and `test-supabase-select.ts` committed with hardcoded credentials. `terraform/terraform.tfvars.example` added with real project URL and truncated JWT. `test-supabase-select.ts` contained a **full JWT token fragment** (`eyJhbG…t_D8`). |
| **Aug 9–10** | Multiple merge conflicts resolved (`617d126`, `738a473`), each time re-introducing leaked values |
| **Aug 10** | `de76985` — "security: sanitize hardcoded Supabase key in test-supabase-select script" (incomplete — only changed one file, left fallback intact in others) |
| **Aug 11 10:27 UTC** | Sentinel agent `49950c0` — "🛡️ Sentinel: [CRITICAL] Fix hardcoded Supabase credentials in scripts" — fixed 4 files but missed `test-supabase-expiration-sweeper.ts` and `terraform.tfvars.example` |

### 2.2 What Was Exposed

| File | Credential | Status |
|------|-----------|--------|
| `scripts/test-supabase-select.ts` | `https://gtcguonqciokigxlvfyq.supabase.co` + JWT `eyJhbG…t_D8` | Still leaked (not fixed by latest sentinel) |
| `scripts/trigger-live-heroku-sweep.ts` | URL fallback + full JWT token fallback | **Still leaked** — fallback values present |
| `scripts/test-supabase-expiration-sweeper.ts` | URL fallback `https://gtcguonqciokigxlvfyq.supabase.co` | **Still leaked** — not touched by any fix |
| `scripts/grant-supabase-permissions.ts` | PostgreSQL connection string with project name | **Still leaked** — not touched by any fix |
| `scripts/reset-status-to-pinned.ts` | PostgreSQL connection string with project name | **Still leaked** — not touched by any fix |
| `terraform/terraform.tfvars.example` | URL + truncated JWT + DuckDNS token + SSH key stub | **Still leaked** — not touched by any fix |
| `.env.example` | Placeholder values only | ✅ Safe (properly uses "your-" placeholders) |

### 2.3 Why It Persisted

1. **No automated scanning** — No git-secrets, gitguardian, gitleaks, or CI hook exists to catch secrets on commit
2. **Hardcoded fallback pattern** — Code used `process.env.X || "http://real.url"` pattern. The sentinel agents replaced `||` chains but some files were missed entirely (5 out of 6 affected files still have leaked credentials)
3. **Merge conflict resolution** — Multiple merge conflicts re-introduced leaked values because there was no pre-commit check
4. **Silos between agents** — Multiple agents (different sessions) worked on the repo independently. One agent's "fix" didn't know about another's changes
5. **Example config files treated as safe** — `terraform.tfvars.example` was treated as a template but contained real infrastructure values
6. **914 commits of history** — The project has 914 commits. Even if the latest commit is clean, all prior commits with secrets are permanently public on GitHub (including when force-pushed)

---

## 3. Root Cause Analysis

### 3.1 Direct Cause
Multiple autonomous agents (human and AI) wrote Supabase credentials directly into source code and example configuration files, using the pattern `process.env.VAR || "real_value"` for development convenience.

### 3.2 Systemic Causes

| # | Cause | Category |
|---|-------|----------|
| 1 | No pre-commit secret scanning | Process |
| 2 | No CI-based secret scan | Process |
| 3 | Hardcoded "fallback" credentials in production code | Engineering practice |
| 4 | No credential lifecycle management (no rotation policy) | Operations |
| 5 | Multiple agents with independent access, no coordination | Governance |
| 6 `.example` files committed with real values (not sanitized) | Configuration |
| 7 | Git history is immutable — once leaked, always leaked | Architecture |

### 3.3 The "Sentinel Pattern" Problem

The repo already had a Sentinel agent that detects and fixes leaked credentials. However:
- It only scans the **working tree**, not historical commits
- It fixes **individual files**, not the pattern
- It operates **silently** (creates PRs that nobody reviews)
- There is **no escalation** if the sentinel misses files
- Multiple sentinels have fired (35, 69, and the latest), each only partially fixing the problem

**This is a band-aid on a hole that needs a different approach.**

---

## 4. Impact Assessment

### 4.1 Confirmed Impact
- **Project URL exposed** (`gtcguonqciokigxlvfyq.supabase.co`) — This alone allows:
  - Discovering table schemas via the public Supabase dashboard
  - Attempting to use exposed JWT tokens with the Supabase REST API
  - Identifying the project for targeted attacks
- **PostgreSQL hostnames exposed** (`aws-1-us-west-2.pooler.supabase.com`) — Confirms infrastructure details
- **JWT token fragments** — Partial tokens may or may not be valid, but the anon key pattern is exposed

### 4.2 Potential Impact
- Data exfiltration from `pin_records` table
- Data manipulation (unpinning legitimate content)
- Access to associated services (Heroku worker, IPFS pinning)
- Reputation damage if content integrity is compromised

### 4.3 What Was NOT Exposed
- `.env` files with full service-role keys (these are properly gitignored)
- The Algorand escrow address (`ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY`) is a public mainnet contract — acceptable
- No private keys or seed phrases were found in the leaks

---

## 5. Immediate Actions (Required)

The following actions must be taken immediately:

1. **Rotate all Supabase keys** — Create new anon and service-role keys; revoke old ones
2. **Rotate the PostgreSQL connection string** — Regenerate the database password
3. **Force-push and rewrite git history** — Use `git-filter-repo` or `BFG` to permanently remove credentials from all commits (see Section 6)
4. **Scan all other repositories** — The same patterns likely exist in other IcanBENCHurCAT repos
5. **Audit access logs** — Check Supabase dashboard for unauthorized queries from the exposure window (Jul 31 – Aug 11)

---

## 6. No-Repeat Plan (Proposed)

See `NO_REPEAT_PLAN.md` for the full plan.

---

## 7. Lessons Learned

1. **Never hardcode credentials as "fallback" values** — Use environment variables or local config files that are gitignored. Development credentials should be entirely separate from production.
2. **Example config files must contain only fake data** — Replace real URLs/keys with clearly fake placeholders (e.g., `https://project-name.supabase.co`, not the real project slug).
3. **Secrets in Git history are public forever** — Even with force-pushes, the old history exists in forks, CI logs, and GitHub's own caches. Removal tools are imperfect. **Prevention is the only real solution.**
4. **Sentinel agents are not enough** — Automated detection without automated prevention (pre-commit hooks) is reactive, not proactive. The fix rate (~25% of affected files caught per sentinel pass) is unacceptable for secrets.
5. **Coordinate multi-agent work** — When multiple autonomous systems work on the same repo, they need shared secret management practices and awareness of what credentials exist in the codebase.
6. **Treat `*.example` files as production code** — They are committed to the public repo. Write them as if your attackers can read them.

---

*This is a blameless postmortem. All agents involved (human and AI) were operating with good intentions. The issue is systemic, not personal.*
