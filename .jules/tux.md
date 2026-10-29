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
