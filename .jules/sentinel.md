## 2024-08-03 - Hardcoded API Key Exposure in Automation Scripts
**Vulnerability:** A critical API key (`moltbook_sk_...`) was hardcoded across 8 different python automation scripts in the `scripts/` directory (`post2.py`, `post_builds.py`, `post_comment.py`, `post_final_comment.py`, `post_general.py`, `post_to_moltbook.py`, `reply_concordium.py`, `repost_comment.py`).
**Learning:** These scripts were likely created iteratively for interacting with an external social platform (Moltbook), and developers took a shortcut by pasting the key directly into the code instead of pulling from the environment or a config file as per the `scripts/moltbook_SKILL.md` guidelines.
**Prevention:** Always use environment variables (e.g. `os.environ.get("MOLTBOOK_API_KEY", "")`) or secure local config files for secrets when building new tooling or automation scripts. Never commit raw keys to the repository.

## 2024-08-03 - Removing Extraneous Vulnerable Scripts
**Vulnerability:** A critical API key (`moltbook_sk_...`) was hardcoded across 8 different python automation scripts in the `scripts/` directory.
**Learning:** These scripts were helper scripts used by an AI agent and were unrelated to the actual project repository's main purpose. Sometimes, the best way to secure a codebase is to remove dead or extraneous code that is no longer needed but poses a security risk.
**Prevention:** Regularly audit the `scripts/` or `tools/` directories for ad-hoc scripts that might contain hardcoded secrets or other vulnerabilities. If they are no longer necessary, delete them entirely to reduce the attack surface.

## 2024-08-05 - Prevent Information Disclosure via Error Messages
**Vulnerability:** Information Disclosure
**Learning:** The application was directly returning `e?.message` in JSON responses for 500 Server Errors in the `/api/v1/pin` and `/api/v1/renew` endpoints. This could potentially leak internal system paths, underlying database structures, or infrastructure details to malicious users probing the API.
**Prevention:** Always log the actual error message server-side using `console.error` for debugging, but sanitize the API response payload with a safe, generic fallback message (e.g., "Failed to process request. Please try again later.").

## 2024-08-05 - Enforce HSTS (Strict-Transport-Security)
**Vulnerability:** Missing Security Headers
**Learning:** While the application had some basic security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection), it was missing the critical `Strict-Transport-Security` header.
**Prevention:** Ensure `Strict-Transport-Security` (HSTS) is included in global security headers middleware to enforce secure HTTPS connections and prevent protocol downgrade attacks.
