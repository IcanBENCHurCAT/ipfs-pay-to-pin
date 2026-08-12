# Postmortem Template

## Incident: [Title]

**Date discovered**: YYYY-MM-DD
**Date resolved**: YYYY-MM-DD
**Duration**: N days
**Severity**: High / Critical
**Affected repo(s)**: [repo name]

## Executive Summary

[2-3 sentence summary of what happened, what was exposed, and the impact.]

## Timeline

| Time (ET) | Event |
|-----------|-------|
| YYYY-MM-DD HH:MM | Commit introduced credential |
| YYYY-MM-DD HH:MM | First detection (scanner, report, etc.) |
| YYYY-MM-DD HH:MM | Initial response begins |
| YYYY-MM-DD HH:MM | Credential rotated |
| YYYY-MM-DD HH:MM | All affected files sanitized |
| YYYY-MM-DD HH:MM | Prevention measures deployed |

## What Was Exposed

| Credential Type | Where Found | Files Affected |
|-----------------|-------------|----------------|
| e.g., Supabase URL | .env.example, script.ts | [list] |
| e.g., JWT token | src/config.ts | [list] |

## Root Cause

**Primary cause**: [Why did the credential end up in the repo? e.g., "Hardcoded fallback in process.env", "Developer copy-pasted from terminal", ".example file contained real values"]

**Contributing factors**:
- [ ] No pre-commit secret scanning hook
- [ ] No CI secret scan step
- [ ] Multiple agents/workers fixed some files but missed others (siloed remediation)
- [ ] .example files used real values instead of placeholders
- [ ] process.env.X || "real_value" pattern used (always a leak)
- [ ] No credential inventory documented

## Impact Assessment

- **Exposure duration**: N days (YYYY-MM-DD to YYYY-MM-DD)
- **Publicly accessible**: Yes / No (depends on repo visibility)
- **Active exploitation**: Unknown / Yes / No
- **Systems compromised**: [list any services that consumed the leaked credentials]
- **Data at risk**: [what data could have been accessed]

## Remediation Actions

1. [ ] Rotated all exposed credentials at provider
2. [ ] Sanitized all affected files (including git history via rewrite)
3. [ ] Deployed pre-commit hook
4. [ ] Added CI secret scan step
5. [ ] Created credential inventory (SECRETS.md)
6. [ ] Created security policy (SECURITY.md)
7. [ ] Notified affected service owners

## Lessons Learned

1. [ ] **Detection gap**: No automated scanning existed before incident
2. [ ] **Remediation gap**: Multiple independent fix attempts missed files because each agent only looked at working tree, not git history
3. [ ] **Process gap**: No credential inventory meant we didn't know what was exposed until after the leak
4. [ ] **Culture gap**: .example files treated as documentation, not as code — treated real values as acceptable

## No-Repeat Plan

See `NO_REPEAT_PLAN.md` for the layered prevention strategy.

## Status: [OPEN | RESOLVED]
**Owner**: [person/team]
