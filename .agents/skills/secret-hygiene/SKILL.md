---
name: secret-hygiene
description: "Detect, remediate, and prevent credential leaks in Git repositories."
metadata:
  openclaw:
    emoji: "🔐"
---

# Secret Hygiene — Leak Detection, Remediation & Prevention

Detect leaked credentials across full git history, sanitize affected files, and install layered prevention hooks.

## Use when

- A secret scanner (gitleaks, git-secrets, SonarQube) reported leaked credentials in git history
- Production credentials (API keys, DB URLs, JWTs, connection strings, tokens) were committed to a repo
- An agent or developer accidentally pushed secrets to a public or shared repo
- A repo lacks automated secret scanning (pre-commit hook + CI step)
- A postmortem or no-repeat plan is needed after a credential exposure incident

## Key Principle

Most secret scanners only check the working tree. This skill's critical differentiator: **scan ALL git history** (`git log --all -p`), not just the latest commit. With hundreds of commits, working-tree-only scans miss ~90% of the problem.

## Workflow

### Phase 1 — Detect

1. Read the full credential pattern table: `references/credential-patterns.md`
2. Scan git history: `git log --all -p -- <files>` or `git log --all -p` for full repo scan
3. Also scan working tree: `git diff --cached` and check untracked files
4. Build a manifest: `file → credential type → commits containing it → earliest commit`

### Phase 2 — Remediate

1. **Read rotation checklist first**: `references/credential-rotation-checklist.md`
2. Rotate every exposed credential at its provider (Supabase dashboard, AWS console, etc.) **before** changing code — old values will still be used by running services
3. Replace hardcoded credentials with `process.env.VAR_NAME` or equivalent
4. Fix `.example` / `.tfvars.example` files — never commit real infrastructure values
5. Apply `scripts/pre-commit-hook.sh` to prevent recurrence

### Phase 3 — Prevent

1. Deploy pre-commit hook: read `scripts/pre-commit-hook.sh`, install to `.git/hooks/pre-commit`
2. Add CI secret scan step (see `references/gitleaks-ci-example.yaml` for GitHub Actions)
3. Create `SECRETS.md` documenting what credentials exist and where they're stored
4. Create `SECURITY.md` with credential handling rules
5. Produce postmortem from `references/postmortem-template.md`
6. Create no-repeat plan from `references/norepeat-template.md`

## Critical Safety Rules

- **Never commit real credentials** — even in `.example`, `.env.example`, docs, or commit messages
- **Rotate before sanitizing** — old values remain active until rotated at the provider
- **Git rewriting does not remove secrets** from CI logs, forks, or mirror repos. Rotation is the only safe fix.
- The pattern `process.env.X || "real_value"` is **always a leak** — the fallback is the real credential
- Pre-commit hook patterns: read `references/credential-patterns.md` for the full pattern table
- Pre-commit hook bugs: the script at `scripts/pre-commit-hook.sh` fixes the common dead-code bug (untracked files not scanned, unused variables). Always use the shipped version.

## Files

| File | Purpose |
|------|---------|
| `scripts/pre-commit-hook.sh` | Bash pre-commit hook — blocks commits with recognized credential patterns |
| `references/credential-patterns.md` | Full table of credential patterns, examples, and what to match/ignore |
| `references/credential-rotation-checklist.md` | Step-by-step rotation checklist per provider (Supabase, AWS, etc.) |
| `references/postmortem-template.md` | Structured postmortem template with sections for timeline, root cause, impact |
| `references/norepeat-template.md` | No-repeat plan template: layered prevention strategy |
| `references/gitleaks-ci-example.yaml` | GitHub Actions workflow for gitleaks CI step |
| `references/secrets-template.md` | SECRETS.md template documenting credential inventory |
| `references/security-policy-template.md` | SECURITY.md template with credential handling rules |
