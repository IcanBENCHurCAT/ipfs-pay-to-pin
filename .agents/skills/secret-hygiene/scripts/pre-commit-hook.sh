#!/usr/bin/env bash
# Pre-commit hook: block commits containing recognized credential patterns.
# Install: cp pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

# Abort on first match
set -e

# Get all staged file contents (including new files)
get_staged_content() {
  local files
  files=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null) || return 0
  for f in $files; do
    if [ -f "$f" ]; then
      git show ":$f" 2>/dev/null
    fi
  done
}

# Credential patterns — each is a grep -E regex
# Format: PATTERN|DESCRIPTION
# Strings in double-quotes after | are ignored in .example files
PATTERNS=(
  "supabase\.(co|com)/project/[a-zA-Z0-9]+|Supabase project URL"
  "eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|JWT token"
  "postgresql://[^:]+:[^@]+@[a-zA-Z0-9.-]+/[a-zA-Z0-9]+|PostgreSQL connection string"
  "postgres://[^:]+:[^@]+@[a-zA-Z0-9.-]+/[a-zA-Z0-9]+|PostgreSQL legacy URL"
  "sk-[a-zA-Z0-9]{20,}|OpenAI-style API key"
  "AIza[0-9A-Za-z_-]{35}|Google API key"
  "AKIA[0-9A-Z]{16}|AWS Access Key ID"
  "[\"'](?:[a-zA-Z0-9]{40})[\"']\s*[=;]\s*(?:AWS_|SECRET_|ACCESS_|API_|TOKEN_|KEY_|_KEY|_SECRET)\s*[\"']?|Generic API key pattern"
  "https://[a-z0-9]+\.duckdns\.org/|DuckDNS subdomain"
  "x402.*api[_-]?key|x402 API key reference"
  "godaddy.*[a-zA-Z0-9]{20,}|GoDaddy API credential"
  "facilitator\.goplausible|Plausible facilitator URL"
)

CONTENT=$(get_staged_content)
FOUND=0

echo "🔐 Scanning staged changes for credentials..."

for entry in "${PATTERNS[@]}"; do
  PAT=$(echo "$entry" | cut -d'|' -f1)
  DESC=$(echo "$entry" | cut -d'|' -f2)

  if echo "$CONTENT" | grep -qiE "$PAT" 2>/dev/null; then
    # Check if this is inside an .example file with a placeholder
    # We still flag it — the developer must verify it's a real value
    echo "  ⚠️  Possible $DESC detected!"
    echo "$CONTENT" | grep -niE "$PAT" 2>/dev/null | while read -r line; do
      echo "    → $line"
    done
    FOUND=1
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "❌ Commit blocked: potential credentials detected."
  echo "   - Replace hardcoded values with environment variables."
  echo "   - If these are placeholders (e.g. in .env.example), use 'PLACEHOLDER' or 'your_token_here'."
  echo "   - Never commit real credentials, even in example files."
  echo ""
  exit 1
fi

echo "   ✅ No credentials detected."
exit 0
