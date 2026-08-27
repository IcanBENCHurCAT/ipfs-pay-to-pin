## 2025-02-26 - Unrestricted IP Spoofing via X-Forwarded-For in Rate Limiter
**Vulnerability:** IP Spoofing via X-Forwarded-For in Rate Limiter (`src/middleware/rateLimiter.ts`).
**Learning:** Blindly trusting `X-Forwarded-For` or `X-Real-IP` headers without verifying whether proxying is trusted allows clients to easily bypass rate limits by sending random IP addresses in request headers.
**Prevention:** Native IP extraction should always take precedence over proxy headers. Proxy headers (`X-Forwarded-For`, `X-Real-IP`) must only be evaluated if the application is configured with explicit proxy trust (e.g., `TRUST_PROXY=true`).

## 2026-08-13 - Cryptographic Randomness for Temp File Suffixes in DbManager
**Vulnerability:** Insecure randomness in temporary file creation. `Math.random()` was used to generate suffixes for temporary registry files during atomic renaming in `DbManager.saveItems`.
**Learning:** `Math.random()` is PRNG-based and predictable. Predictable temporary file paths can enable race conditions or symlink/file collision attacks in shared environments or local disk fallback scenarios.
**Prevention:** Use cryptographically secure random bytes via `crypto.randomBytes(4).toString('hex')` whenever generating unique temporary paths, filenames, or tokens.

## 2026-08-16 - Path Traversal in Filename Sanitization
**Vulnerability:** Filename sanitization stripped directory separators `/` and `\` but did not strip `..` path traversal sequences prior to leading-dot cleaning.
**Learning:** Stripping slashes alone may still leave `..` sequences intact, which could cause subtle path traversal or unexpected file paths in downstream local storage or Pinata metadata.
**Prevention:** Always explicitly strip `..` sequences (`replace(/\.\./g, '')`) alongside path separators and URL-decoding in filename sanitization routines.

## 2024-10-27 - Incomplete Fix for Escrow Drain Vulnerability
**Vulnerability:** The previous fix for the escrow drain vulnerability capped the refund based on `content-length`. However, `content-length` can be spoofed independently of the JSON body's `data.length`. Since the payment middleware evaluates the price using the true JSON size when parsing succeeds, an attacker could upload a small payload (paying a small fee) while sending a massive `content-length` and spoofed `x-payment-amount` header. If the job failed (e.g., rejected by queue validation), the refund fallback used the spoofed `content-length`, draining the escrow.
**Learning:** When validating and capping values derived from multiple inputs (e.g., payload size fallback vs actual size), downstream logic must mirror the exact decision tree used by the upstream validation layer.
**Prevention:** Capped the refund based on the exact same parsed `data.length` variable that the payment middleware uses when JSON parsing succeeds, falling back to `content-length` only when parsing fails.

## 2026-08-26 - Unsafe Exception Information Leakage via Stack Traces and Unhandled HTTP Errors
**Vulnerability:** Logging raw stack traces and internal error object details during uncaught exceptions or unhandled HTTP route errors risks exposing sensitive internal application state, environment variables, or database query specifics to logs or HTTP API responses.
**Learning:** Global process exception handlers (`uncaughtException`, `unhandledRejection`) and framework error handlers (`app.onError`) must sanitize error details in production environments (`NODE_ENV=production`), returning generic standard error responses to clients while preserving process lifecycle constraints (`process.exit(1)`).
**Prevention:** Omit stack traces in production logs, handle `HTTPException` responses transparently, return sanitized `{ error: "Internal Server Error", message: "An unexpected error occurred." }` payloads for unhandled HTTP errors, and preserve `process.exit(1)` on uncaught exceptions.
