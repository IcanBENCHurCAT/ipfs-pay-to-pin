# Credential Patterns Reference

Full table of credential patterns to detect, with examples and ignore rules.

## Database Credentials

| Pattern | Regex | Example | Ignore in |
|---------|-------|---------|-----------|
| Supabase URL | `supabase\.(co|com)/project/[a-zA-Z0-9]+` | `https://xyz.supabase.co/project/abc123` | Never |
| PostgreSQL URI | `postgresql://[^:***@]+@` | `postgresql://user:pass@host/db` | Never |
| Postgres URI | `postgres://[^:***@]+@` | `postgres://user:pass@host/db` | Never |
| MongoDB URI | `mongodb(\+srv)?://[^:***@]+@` | `mongodb://user:pass@cluster/db` | Never |

## Token & Key Patterns

| Pattern | Regex | Example | Ignore in |
|---------|-------|---------|-----------|
| JWT | `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Never |
| OpenAI key | `sk-[a-zA-Z0-9]{20,}` | `sk-proj-abc123...` | Never |
| AWS Access Key | `AKIA[0-9A-Z]{16}` | `AKIAIOSFODNN7EXAMPLE` | Never |
| Google API key | `AIza[0-9A-Za-z_-]{35}` | `AIzaSyD-abc123...` | Never |
| Generic 40-char hex | `"[a-f0-9]{40}"` | `"a1b2c3d4e5..."` | `.example` if value is placeholder |

## Service-Specific

| Pattern | Example | Source |
|---------|---------|--------|
| DuckDNS | `https://[a-z0-9]+\.duckdns\.org/` | DNS provider |
| GoDaddy API | `godaddy.*[a-zA-Z0-9]{20,}` | DNS provider |
| Plausible Facilitator | `facilitator\.goplausible` | x402 payment |
| Pinata JWT | Pinata admin JWT token | IPFS pinning |
| Algorand address | `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` | 58-char base32 |
| x402 API key | `x402.*api[_-]?key` | Payment gateway |

## Anti-Patterns (Always Leaks)

These patterns indicate a credential is hardcoded even if wrapped in env var syntax:

```typescript
// ALWAYS A LEAK — the fallback IS the credential
process.env.SUPABASE_URL || "https://xyz.supabase.co/project/abc123"

// ALWAYS A LEAK — default value exposes secret
const API_KEY = process.env.API_KEY || "real_key_here";

// NEVER do this in any file including .example
const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6...";
```

## Safe Placeholder Examples

Use these for `.example` and `.env.example` files:

```
# Good — clearly a placeholder
SUPABASE_URL=https://your-project.supabase.co
API_KEY=your_api_key_here
JWT_TOKEN=your_jwt_token_here
DATABASE_URL=postgresql://localhost:5432/your_db

# Good — no real value
PINATA_JWT=your_pinata_jwt_here
ALGORAND_ADDRESS=your_algorand_address_here
```

## Detection Command

Scan ALL git history:
```bash
# Full repo scan (may be slow on large repos)
git log --all -p -- . | grep -nE "supabase\.(co|com)/project/|eyJ[A-Za-z0-9_-]{10,}"

# Scan specific file types
git log --all -p -- '*.ts' '*.json' '*.yaml' '*.yml' '*.tfvars'

# Find earliest commit containing a pattern
git log --all --diff-filter=A --format="%H %ai" -- . | head
```
