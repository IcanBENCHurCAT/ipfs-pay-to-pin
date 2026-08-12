# No-Repeat Plan Template

## Layer 1: Pre-Commit Prevention

**Hook**: `.git/hooks/pre-commit` (from `scripts/pre-commit-hook.sh`)
**Action**: Blocks commits containing recognized credential patterns
**Coverage**: All staged files (added, modified, copied)
**Limitation**: Does not scan untracked files (by design — untracked files are developer-local)

## Layer 2: CI-Enforced Scanning

**Tool**: gitleaks (or equivalent)
**Trigger**: Every PR and merge to main/master
**Action**: Fails the build if secrets are detected in the diff or base branch
**Coverage**: All code paths through the PR/merge process

## Layer 3: Credential Inventory

**Document**: `SECRETS.md` (or `docs/SECRETS.md`)
**Contents**: 
- List of all credentials the project uses
- Where each is stored (env vars, secret manager, etc.)
- Rotation schedule
- Owner/contact for each credential

**Maintenance**: Updated whenever a new credential is added or an old one is removed.

## Layer 4: Security Policy

**Document**: `SECURITY.md`
**Contents**:
- Rule: Never commit real credentials to any file (including .example)
- Rule: Use `process.env.VAR_NAME` pattern, never fallback to real values
- Rule: .example files must use placeholder values only
- Rule: All credentials must be in the SECRETS.md inventory
- Rule: Rotate credentials on a schedule and after any suspected exposure
- Rule: Audit access to credential stores regularly

## Layer 5: Developer Education

**Onboarding**: New developers receive the security policy and know about the pre-commit hook.
**Review**: Code reviews include a check for hardcoded credentials.
**Alerts**: Team notified immediately if a secret scan fails.

## Audit Schedule

| Check | Frequency | Owner |
|-------|-----------|-------|
| Pre-commit hook works | Every commit | Developer |
| CI secret scan passes | Every PR/merge | CI system |
| SECRETS.md up to date | Monthly | Maintainer |
| Credential rotation | Per schedule | Maintainer |
| Full git history scan | After any incident | Security lead |

## Incident Response

If a credential leak is detected:
1. Rotate the credential at the provider (IMMEDIATELY)
2. Scan full git history to find all affected files
3. Sanitize all affected files
4. Update SECRETS.md
5. Write postmortem
6. Verify all prevention layers are active
