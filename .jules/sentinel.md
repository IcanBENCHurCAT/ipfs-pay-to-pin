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

## 2024-10-27 - Escrow Drain Vulnerability via Header Spoofing
**Vulnerability:** The application blindly trusted the `x-payment-amount` header for processing refunds on pinning failures. An attacker could spoof this header with an arbitrarily large number, resulting in a refund far exceeding their actual payment, effectively draining the escrow wallet.
**Learning:** Client-provided headers (such as `x-payment-amount` or `x-payment-sender`) must never be implicitly trusted for sensitive financial operations without server-side validation or bounds checking. While the gateway sits behind a payment proxy that ideally sets these headers securely, defense-in-depth requires the downstream service to enforce sanity limits.
**Prevention:** Implement strict server-side validation and bounds checking for all client-provided data involved in financial transactions. In this case, capping the refund to the maximum expected price dynamically calculated from the payload size prevents the attack.

## 2024-02-14 - Hardcoded Supabase Credentials in Migration/Test Scripts
**Vulnerability:** A hardcoded PostgreSQL connection string containing a valid plaintext database password (`postgresql://postgres...`) was present across multiple migration and testing scripts in the `scripts/` directory (e.g., `create-supabase-schema.ts`, `trigger-live-heroku-sweep.ts`).
**Learning:** Hardcoding database credentials in script files, even those intended only for local development or testing, poses a significant risk of credential leakage if the repository is made public or accessed by unauthorized users.
**Prevention:** All database connections must use environment variables (e.g., `process.env.SUPABASE_DATABASE_URL`). Add fail-fast validation to scripts to ensure they exit securely if the required environment variables are missing.

## 2025-02-14 - Hardcoded Mainnet Deployment Mnemonic Fallback
**Vulnerability:** A hardcoded 25-word mnemonic phrase ("sheriff cruise oxygen...") was provided as a fallback value for `os.getenv("DEPLOYER_MNEMONIC")` in mainnet deployment scripts (`escrow/deploy_mainnet.py` and `escrow/opt_in_mainnet.py`).
**Learning:** Providing a hardcoded, publicly known mnemonic as a fallback in mainnet scripts is extremely dangerous. If the `.env` file fails to load or the environment variable is missing, the script will silently deploy the production contract using a compromised public key, leading to potential loss of funds or hostile takeover of the smart contract.
**Prevention:** Mainnet and production automation scripts must NEVER contain hardcoded default credentials or mnemonics. Always use environment variables and implement fail-fast validation that immediately exits with an error (e.g., `exit(1)`) if critical credentials are missing.

## 2026-08-11 - Untested Rate Limiter Middleware
**Vulnerability:** Untested rate limiters can easily have off-by-one errors or incorrect IP extraction logic (e.g., trust header spoofing or failing to read actual IP from native connection), leading to rate limit bypass or DDoS vulnerabilities.
**Learning:** Testing rate limiting middleware requires deterministic time-travel and mocking Hono's complex Context and Request structures, ensuring that fallback IPs (native connection vs x-forwarded-for vs x-real-ip) are extracted in a strict, prioritized security order.
**Prevention:** Implement unit tests with `vi.useFakeTimers()` to test exactly 60 requests per minute limit, the correct rate limit headers returned, the 429 response body when exceeded, and the correct IP fallback resolution.

## 2026-08-12 - Adding Content Security Policy (CSP) header
**Vulnerability:** Missing Content Security Policy (CSP) header in the application.
**Learning:** When modifying or adding a Content-Security-Policy (CSP) header, avoid overly restrictive policies like `default-src 'none';` as it breaks the built-in `@hono/swagger-ui` documentation interface.
**Prevention:** Use a more pragmatic policy (e.g., `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`) to maintain API documentation functionality while still mitigating XSS risks.

## 2026-08-16 - Path Traversal in Filename Sanitization
**Vulnerability:** Filename sanitization stripped directory separators `/` and `\` but did not strip `..` path traversal sequences prior to leading-dot cleaning.
**Learning:** Stripping slashes alone may still leave `..` sequences intact, which could cause subtle path traversal or unexpected file paths in downstream local storage or Pinata metadata.
**Prevention:** Always explicitly strip `..` sequences (`replace(/\.\./g, '')`) alongside path separators and URL-decoding in filename sanitization routines.

## 2024-10-27 - Incomplete Fix for Escrow Drain Vulnerability
**Vulnerability:** The previous fix for the escrow drain vulnerability capped the refund based on `content-length`. However, `content-length` can be spoofed independently of the JSON body's `data.length`. Since the payment middleware evaluates the price using the true JSON size when parsing succeeds, an attacker could upload a small payload (paying a small fee) while sending a massive `content-length` and spoofed `x-payment-amount` header. If the job failed (e.g., rejected by queue validation), the refund fallback used the spoofed `content-length`, draining the escrow.
**Learning:** When validating and capping values derived from multiple inputs (e.g., payload size fallback vs actual size), downstream logic must mirror the exact decision tree used by the upstream validation layer.
**Prevention:** Capped the refund based on the exact same parsed `data.length` variable that the payment middleware uses when JSON parsing succeeds, falling back to `content-length` only when parsing fails.