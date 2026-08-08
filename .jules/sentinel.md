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

## 2025-02-14 - Information Disclosure via On-Chain Transaction Notes
**Vulnerability:** Internal error messages (`e?.message`) were passed directly into the `initiateOnChainRefund` reason payload in `src/index.ts`, which then embedded them into an Algorand transaction note.
**Learning:** Writing raw internal error states directly to a public, immutable blockchain is highly dangerous. It leaks infrastructure details, stack context, or other sensitive runtime data that can never be deleted or redacted.
**Prevention:** Always sanitize data intended for on-chain storage or transaction notes. Use static, generic messages for public audit trails (e.g., "Refund for failed operation") while logging detailed error traces internally on the backend.
## 2024-10-27 - Escrow Drain Vulnerability via Header Spoofing\n**Vulnerability:** The application blindly trusted the `x-payment-amount` header for processing refunds on pinning failures. An attacker could spoof this header with an arbitrarily large number, resulting in a refund far exceeding their actual payment, effectively draining the escrow wallet.\n**Learning:** Client-provided headers (such as `x-payment-amount` or `x-payment-sender`) must never be implicitly trusted for sensitive financial operations without server-side validation or bounds checking. While the gateway sits behind a payment proxy that ideally sets these headers securely, defense-in-depth requires the downstream service to enforce sanity limits.\n**Prevention:** Implement strict server-side validation and bounds checking for all client-provided data involved in financial transactions. In this case, capping the refund to the maximum expected price dynamically calculated from the payload size prevents the attack.

## 2024-02-14 - Hardcoded Supabase Credentials in Migration/Test Scripts
**Vulnerability:** A hardcoded PostgreSQL connection string containing a valid plaintext database password (`postgresql://postgres...`) was present across multiple migration and testing scripts in the `scripts/` directory (e.g., `create-supabase-schema.ts`, `trigger-live-heroku-sweep.ts`).
**Learning:** Hardcoding database credentials in script files, even those intended only for local development or testing, poses a significant risk of credential leakage if the repository is made public or accessed by unauthorized users.
**Prevention:** All database connections must use environment variables (e.g., `process.env.SUPABASE_DATABASE_URL`). Add fail-fast validation to scripts to ensure they exit securely if the required environment variables are missing.
