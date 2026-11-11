## 2023-10-27 - Enhance CI/CD Type Checking for SDK

**Learning:** The project relies on pnpm workspaces, and default tsc checks from the root may overlook subpackages if tsconfig is not properly mapped. Also, test states (like local `queue/` files) must be strictly cleaned up to avoid polluting pull requests.
**Action:** When adding CI checks for a specific workspace package, use the `pnpm --filter <package-name>` syntax. Always ensure `git clean -fd` or similar checks are made to prevent stray mock test artifacts from being committed.

## 2024-08-20 - Enforce Pull Request Titles & .gitignore Artifact Polish

**Learning:** When dealing with CI/CD checks for specific PR title formats, conventional commit parsers (like `amannn/action-semantic-pull-request`) do not inherently support spaces or emojis in the `<type>` field (e.g., `🐧 Tux`). Instead, standard bash `grep` rules inside GitHub workflows offer the simplest and most robust approach to custom semantic enforcement. Also, when modifying `.gitignore` for a directory like `queue/`, it's safer to just ignore the whole directory (and explicitly track files you need) rather than try to wildcard specific test output names, as tests can generate new arbitrary mock files like `registry.json` dynamically.
**Action:** Use native bash string validation (`grep -E`) for custom persona-based PR title workflows to bypass strict conventional commit validation limits. When managing test artifacts, strictly ignore the entire artifact root path in `.gitignore` rather than sub-targeting specific file extensions to prevent future untracked mock states from leaking.
## 2024-08-24 - [Remove npm usage from GitHub Actions] \n **Learning:** To ensure true package manager exclusivity, verify all CI workflows are utilizing the desired package manager (pnpm), as boilerplate actions frequently use npm by default. Node versions should also rely on `.node-version` where available for a single source of truth. \n **Action:** Always audit workflow `.yml` files for hardcoded package manager commands or versions when working under strict dependency constraints.

## 2025-02-16 - Add SDK Unit Test Suite for IpfsPayToPinClient

**Learning:** Testing workspace client SDKs that use axios for HTTP requests can be cleanly isolated with `vi.mock('axios')` in Vitest, allowing full coverage of constructor wallet setup, getAddress, error handling, and API endpoints without network calls.
**Action:** When adding unit tests for SDK workspace packages, isolate external API calls with mocked axios instances and ensure all exported custom Error classes are verified for inheritance and properties.

## 2026-03-30 - Unit Testing renew_pin in Python SDK

**Learning:** When mocking x402 payment flows in Python SDK unit tests using `algosdk.transaction`, `AlgodClient.suggested_params()` must return a valid `SuggestedParams` object containing a base64-encoded genesis hash (`gh`) rather than a default `MagicMock` to prevent `base64.b64decode` type errors during transaction dictification and signing.
**Action:** When writing Python SDK tests that involve Algorand transaction signing, always provide a complete `SuggestedParams` with `genesis_hash`, `genesis_id`, `fee`, and `first_valid_round`. Use `algosdk.v2client.algod.AlgodClient` to fetch live params if no mock is acceptable, or construct a minimal valid params dict for unit tests.

## 2026-08-26 - SDK Unit Tests: Mock HTTP and Wallet Keys Properly

**Learning:** Python SDK unit tests that interact with IPFS gateway APIs need `responses` or `requests-mock` for HTTP mocking, while wallet key tests should use `unittest.mock.patch` for crypto module imports. Always set `max_price_usdc` ceiling in SDK constructor to cap spending in payment flows, and mock AlgodClient for transaction-related logic.
**Action:** Use `responses` for HTTP mocking and `unittest.mock.patch` for module imports in Python SDK unit tests. Never leave `AlgodClient` calls unmocked in tests that exercise transaction pathing.

## 2026-08-28 - npm Trusted Publishing (OIDC) requires Node 22 & npm >= 11.5.1
**Learning:** Tokenless npm Trusted Publishing via GitHub Actions OIDC (`--provenance`) is not supported by `pnpm publish` or npm 10 (bundled in Node 20), which triggers `ENEEDAUTH`. It requires npm >= 11.5.1 and Node 22 to exchange the OIDC ambient token for Sigstore transparency logging and publishing.
**Action:** In `.github/workflows/post-release.yml`, keep `node-version: '22'`, install `npm@11.5.1`, and invoke `cd sdk && npm publish --provenance --access public`. Do not revert to Node 20 or `pnpm publish`.
## 2026-09-19 - JSDoc Documentation Enhancements\n**Learning:** When adding JSDoc comments to constructor methods of custom Error classes, ensure they adequately describe the specific failure case (e.g., Budget, Configuration, Payment Declined) and outline the constructor parameters. \n**Action:** Use specific, descriptive JSDoc block comments above class definitions and their constructors in TypeScript projects.
## 2026-09-22 - Fix Invalid CI Action Versions
**Learning:** Hardcoding future or non-existent GitHub Action versions (like `actions/checkout@v7` or `pnpm/action-setup@v6`) fundamentally breaks CI/CD pipelines before they can even start, as the GitHub Actions runner fails to fetch the action source code.
**Prevention:** Always verify action versions against public registries or stick to established current major versions (like `v4` for node/checkout) unless specifically testing an upstream prerelease.
## 2026-09-30 - Fix Invalid CI Action Versions
**Learning:** Hardcoding future or non-existent GitHub Action versions (like `actions/checkout@v7` or `pnpm/action-setup@v6`) fundamentally breaks CI/CD pipelines before they can even start, as the GitHub Actions runner fails to fetch the action source code.
**Action:** Always verify action versions against public registries or stick to established current major versions (like `v4` for node/checkout) unless specifically testing an upstream prerelease.

## 2026-10-03 - Repo license is MIT, do not enforce AGPL
**Learning:** Garret relicensed this repo from AGPL-3.0-or-later to MIT on 2026-09-30, then reverted two Tux PRs (#264, #265) on 2026-10-03 that had re-applied AGPL. The MIT references were deliberate, not erroneous.
**Action:** Never change license files or license fields back to AGPL. The repo stays MIT unless Garret says otherwise.

## 2026-10-10 - Align Python SDK renew_pin route and payload with Gateway API

**Learning:** When client SDKs (like `python-sdk`) call gateway endpoints, verify that the path and request body match the actual gateway routes in `src/index.ts`, OpenAPI specs, and TypeScript SDK implementations. The gateway expected `POST /api/v1/renew` with body `{"cid": cid}`, whereas the Python client previously targeted `POST /api/v1/pin/{cid}/renew` without a body, causing 404 errors.
**Action:** Always cross-reference client SDK endpoint paths and request bodies against gateway route handlers (`src/index.ts`) and OpenAPI specs when auditing or writing SDK methods.

## 2026-10-24 - Migrate Python SDK Algorand Transaction Signing to Atomic Transaction Composer

**Learning:** In `py-algorand-sdk` (v2.12+), calling `txn.sign(private_key)` emits a `DeprecationWarning` instructing callers to use `sign_transaction_with_signer(txn, AccountTransactionSigner(private_key))`. Updating `client.py` to use `AccountTransactionSigner` and `sign_transaction_with_signer` eliminates deprecation warnings while ensuring full compatibility with atomic transaction composition standards.
**Action:** Always use `AccountTransactionSigner` and `sign_transaction_with_signer` from `algosdk.atomic_transaction_composer` when signing Algorand transactions in Python SDK code.

## 2026-10-27 - Integrate Ruff Python Linting into CI Workflow and SDK

**Learning:** Adding `ruff` as a development dependency in `pyproject.toml` and executing `ruff check .` in GitHub Actions CI ensures automated style and type annotation enforcement across Python packages.
**Action:** Always include `ruff check` in CI workflows for Python subpackages to catch unused imports, unformatted code, and type annotation issues automatically before merging.

## 2026-10-28 - Standardize Workflow Node Versions & Enforce Release Test Guards

**Learning:** Release workflows (`post-release.yml`) must run unit test suites prior to package publication to prevent publishing broken build artifacts. In addition, `pnpm/action-setup` must precede `actions/setup-node` with `cache: 'pnpm'` and `node-version-file: '.node-version'` to guarantee single-source-of-truth Node versioning and fast CI caching.
**Action:** Always verify that release actions execute test suites (`pnpm test` / `pytest`) before build/publish steps and use `.node-version` for Node.js setup across all GitHub Actions workflows.

## 2026-11-01 - Parallelize CI Jobs & Add Multi-Python Version Matrix Testing

**Learning:** Splitting multi-language CI workflows into distinct parallel jobs (e.g. `test-ts` and `test-python`) optimizes CI pipeline execution speed by running Node and Python test suites in parallel without setting up redundant language environments in each job. Using GitHub Actions `strategy.matrix` for Python allows continuous automated verification across supported Python runtimes (3.11, 3.12, 3.13).
**Action:** When configuring multi-language CI pipelines in GitHub Actions, create separate parallel jobs for each language ecosystem and leverage matrix strategies for all supported runtime versions.

## 2026-11-05 - Ensure Python SDK PinResponse Exposes gateway_url and Normalizes Expiration Keys

**Learning:** When client SDKs map response dictionaries to model dataclasses (e.g. `PinResponse`), ensure all key fields documented in gateway responses (such as `gateway_url` and `expires_at`) are supported with safe fallbacks (`res_json.get("expires_at") or res_json.get("pin_expires_at", "")`). Omitting `gateway_url` or using strict single-key lookups causes empty strings or attribute errors for consuming agents.
**Action:** Always verify client SDK model dataclasses against gateway API responses and maintain fallback key lookups for response field variations across direct and payment-flow routes.

## 2026-11-10 - Fix Invalid Actions Version in GitHub Workflows

**Learning:** Hardcoding future or non-existent action versions like `actions/checkout@v7` breaks GitHub Actions workflow runners immediately at setup time. Standardizing on stable major versions (e.g. `actions/checkout@v4`) prevents workflow initialization failures.
**Action:** Periodically verify GitHub Actions action version tags against official releases and ensure workflows use valid, published action tags across all CI/CD pipeline definitions.

## 2026-11-15 - Connect Python CLI Test Suite and Dependencies in CI Workflows

**Learning:** Standalone CLI tools and scripts outside subpackage roots (e.g., `scripts/cli.py` and `tests/test_cli.py`) can easily become orphaned from CI pipelines if `pytest` is invoked strictly inside a subpackage subdirectory (e.g. `cd python-sdk && pytest`). In addition, optional CLI dependencies like `click` and `keyring` must be declared in package manifests (`pyproject.toml`) and environment variables like `PYTHONPATH=..` must be explicitly passed in CI steps so top-level imports resolve reliably.
**Action:** Always declare optional CLI dependencies under `[project.optional-dependencies]` in `pyproject.toml`, include them in `dev`, and pass `PYTHONPATH=..` when running top-level script test suites alongside subpackage test suites in GitHub Actions workflows.

## 2026-11-20 - Enable Pip Dependency Caching in GitHub Actions Workflows

**Learning:** When using `actions/setup-python@v5` in GitHub Actions CI across multi-version matrix jobs (e.g. Python 3.11, 3.12, 3.13), configuring `cache: 'pip'` alongside `cache-dependency-path: 'python-sdk/pyproject.toml'` allows GitHub Actions to automatically restore cached pip wheels and packages across workflow runs, avoiding redundant package downloads and accelerating pipeline execution.
**Action:** Always specify `cache: 'pip'` and `cache-dependency-path` in `actions/setup-python@v5` steps when testing or building Python subpackages with `pyproject.toml` or `requirements.txt`.

## 2026-11-25 - Implement PinNotFoundError in Python SDK to Align with TS SDK Error Hierarchy

**Learning:** The TypeScript SDK defines `PinNotFoundError` extending `GatewayError` (status 404) for programmatic handling of missing/expired CIDs. In multi-language client SDKs, mirroring error class hierarchies (e.g., `PinNotFoundError` extending `PinningFailedError` with `status_code = 404`) enables autonomous agents using Python to detect resource non-existence programmatically without regex pattern matching on error strings or catching uncaught HTTP exceptions.
**Action:** Always export `PinNotFoundError` in `__init__.py` and catch HTTP 404 status codes in client methods (`get_status`, `renew_pin`) to throw `PinNotFoundError` consistently across SDK runtimes.

## 2026-11-26 - Mock x402 Payment Payload Generation in TypeScript SDK Unit Tests

**Learning:** Testing the complete client SDK payment orchestration pipeline (`selectBestAcceptOption`, `maxPriceUsdc` cap checks, `confirmPrice` approval/rejection callbacks, `preferredNetwork` routing, and header encoding) requires mocking HTTP 402 responses with valid `PAYMENT-REQUIRED` headers. However, executing `x402ClientInstance.createPaymentPayload` during unit tests introduces deep dependencies on specific multi-chain signing schemes and EIP-712 / AVM payload schemas. Spying on `(client as any).x402ClientInstance.createPaymentPayload` allows comprehensive unit verification of the entire client control flow and budget guardrails in isolation without coupling tests to external chain cryptographic signers.
**Action:** When adding unit tests for x402 client SDK payment lifecycles, isolate protocol payload signing with `vi.spyOn(client.x402ClientInstance, 'createPaymentPayload')` while using real base64 challenge headers to thoroughly test challenge parsing, price validation, callbacks, and header assembly.

## 2026-11-01 - Document PinNotFoundError in TypeScript and Python SDK READMEs

**Learning:** Autonomous agents and developers relying on SDK documentation need explicit documentation and examples for resource-not-found error classes (`PinNotFoundError`). Without documentation in READMEs and quickstarts, consuming agents fall back to generic error handling instead of taking advantage of typed 404 error classes for automated recovery and diagnostics.
**Action:** Ensure all exported custom error classes (such as `PinNotFoundError`) are documented with code examples in both TypeScript and Python SDK README files.

## 2026-11-02 - Expose get_pin_status and PinStatusResponse Model in Python SDK

**Learning:** In multi-SDK codebases, maintaining consistent method naming across language ecosystems prevents friction for cross-language AI agents and developers. While TypeScript SDK uses `getPinStatus`, Python SDK only provided `get_status` without a typed dataclass for the status return value. Exposing `get_pin_status` as an alias alongside `PinStatusResponse` enables seamless agent tool interoperability and type-safe status deserialization.
**Action:** In multi-language client SDKs, provide snake_case method aliases that match camelCase SDK methods (`get_pin_status` for `getPinStatus`) and export dataclass models representing all structured gateway responses.

## 2026-11-05 - Align Python SDK Verification Commands in Documentation with CI

**Learning:** Developer and contributor documentation (such as `CONTRIBUTING.md` and `README.md`) can drift from automated CI pipeline definitions. When CI workflows require linting checks (`ruff check .`) and top-level CLI integration tests (`PYTHONPATH=.. python -m pytest tests/ ../tests/`), documenting only subpackage `pytest` execution leads to unexpected CI failures for contributors and autonomous agents.
**Action:** Always cross-reference local development test commands in `CONTRIBUTING.md` and `README.md` against `.github/workflows/ci.yml` so contributors run the exact test and lint matrix that runs in CI.

## 2026-11-05 - Standardize Development & Testing Instructions in AGENTS.md and SDK READMEs

**Learning:** Agent guides (`AGENTS.md`) and subpackage READMEs (`sdk/README.md`, `python-sdk/README.md`) easily become out of sync with CI workflows if subpackage documentation omits development setup, build, linting, and testing workflows. Agents and external contributors working inside subdirectories need explicit instructions for `pnpm` workspace filters, package builds, `ruff` checks, and `PYTHONPATH=..` test execution to avoid CI discrepancies.
**Action:** Always document package-level development, lint, build, and test steps in each SDK README and ensure `AGENTS.md` reflects the complete, verified commands executed in GitHub Actions CI workflows.

## 2026-11-06 - Upgrade actions/setup-python to v7 across CI and Release Pipelines

**Learning:** Official GitHub Actions workflows modernize their core action runtime dependencies over time (e.g., migrating runner internals to Node 24 and ESM). While actions like `actions/checkout` and `actions/setup-node` were already standardized on `v7`, `actions/setup-python` was still pinned to `v5`. Upgrading `actions/setup-python` to major version `v7` maintains full backward compatibility for `pip` dependency caching while aligning runner action versions across TypeScript and Python CI jobs.
**Action:** When auditing GitHub Actions workflows, keep first-party GitHub action suites (`checkout`, `setup-node`, `setup-python`) synchronized on their stable modern releases while ensuring all cache configuration parameters remain functional.

## 2026-11-09 - Component-Scoped Issue Templates for Multi-Language SDKs and Gateway

**Learning:** When a repository provides both a backend API service (Gateway) and multi-language client SDKs (TypeScript and Python) with blank issues disabled (`blank_issues_enabled: false`), having generic bug templates causes confusion and incomplete reports. If only the Python SDK has a specialized template while TypeScript SDK issues fall back to a generic template, contributors and autonomous agents lack guided fields for runtime environment (Node vs Python), specific SDK versions, package imports, and network headers.
**Action:** Provide dedicated, component-scoped GitHub issue form templates (`[GATEWAY BUG] `, `[TS SDK BUG] `, `[Python SDK BUG] `) with tailored prompts and labels for each tier of the project architecture.

## 2026-11-09 - Document and Test PaymentSettlementError in TypeScript SDK

**Learning:** When custom error classes (such as `PaymentSettlementError`) are introduced into an SDK to wrap post-payment failures, documentation in `sdk/README.md` and unit tests in `sdk/src/index.test.ts` must be updated concurrently. Without README documentation and code examples, consuming autonomous agents and human developers cannot discover the error class for programmatic recovery. Furthermore, unit tests that mock both initial 402 challenges and subsequent settlement failures ensure that regressions cannot slip through undetected.
**Action:** Whenever a new domain error class is added to an SDK, immediately document it in the package README with usage examples and add unit tests exercising both its instantiation properties and its invocation during failed operations.

## 2026-11-10 - Multi-Chain Network Parity across SDK Issue Templates and Documentation

**Learning:** When multi-chain support expands (such as adding Arbitrum One and Ethereum L1 alongside Base L2, Solana, and Algorand), issue reporting templates and package documentation must remain synchronized across language SDKs. While the Gateway API and TypeScript SDK templates and READMEs included Arbitrum One, the Python SDK bug template omitted Arbitrum One from its network dropdown, and the Python SDK README only listed Base, Solana, and Algorand despite `client.py` having full support for `eip155:42161` and `eip155:1`. Incomplete issue dropdowns and documentation create friction for contributors and autonomous agents attempting to report bugs or integrate supported chains.
**Action:** Ensure all supported payment networks across client SDK implementations are consistently represented in component issue form dropdowns (`.github/ISSUE_TEMPLATE/*`) and accurately documented in package READMEs across every language ecosystem.
