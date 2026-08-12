# SECURITY.md — Credential Handling Policy

## Rules

### 1. Never Commit Real Credentials

No real credentials in any file tracked by git, including:
- Source code (`.ts`, `.js`, `.py`, etc.)
- Config files (`.yaml`, `.json`, `.toml`, etc.)
- Documentation (`.md`, `.txt`, etc.)
- Example files (`.env.example`, `.tfvars.example`, etc.)

**Exception**: Credentials in `.gitignore`'d files (e.g., `.env`, `secrets/`) are okay if they're not shared.

### 2. Use Environment Variables

All credentials MUST be loaded from environment variables:

```typescript
// ✅ OK
const dbUrl = process.env.DATABASE_URL;

// ❌ NEVER
const dbUrl = process.env.DATABASE_URL || "postgresql://real_url_here";
```

### 3. Example Files Use Placeholders

`.example` files MUST use placeholder values:

```
# ✅ OK
DATABASE_URL=postgresql://localhost:5432/your_db
API_KEY=your_api_key_here
JWT=your_jwt_token_here

# ❌ NEVER
DATABASE_URL=postgresql://user:real_password@host/db
API_KEY=AKIAIOSFODNN7EXAMPLE
```

### 4. Credential Inventory

All credentials must be documented in `SECRETS.md`. This file lists what credentials exist and where they're stored — it does NOT contain actual values.

### 5. Rotation

- Rotate credentials on a regular schedule (quarterly recommended)
- Rotate IMMEDIATELY after any suspected exposure
- Never reuse a rotated credential

### 6. Pre-Commit Scanning

This repo has a pre-commit hook that blocks commits containing recognized credential patterns. The hook is mandatory.

### 7. CI Scanning

Every PR and merge is scanned for secrets by CI. Builds fail if secrets are detected.

### 8. Incident Response

If a credential leak is suspected:
1. Rotate at provider immediately
2. Scan full git history
3. Sanitize all affected files
4. Write postmortem
5. Verify all prevention layers
