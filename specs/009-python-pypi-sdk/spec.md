# Feature Specification: Python PyPI SDK & Dual-Publish CI Pipeline

**Feature Branch**: `009-python-pypi-sdk`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Publish a Python PyPI client package (ipfs-pay-to-pin-client) with automated dual-publish CI workflow on release tags."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Python AI Developer Pinning Files (Priority: P1)

As a Python developer or AI agent creator (e.g. using LangChain, LlamaIndex, or AutoGen), I want to install `ipfs-pay-to-pin-client` via `pip` and pin files to IPFS using Algorand microUSDC payments in a single line of Python code.

**Why this priority**: Python is the primary language for the AI ecosystem. Providing a zero-boilerplate, native Python SDK dramatically lowers friction for AI agents paying for decentralized storage.

**Independent Test**: Can be tested by installing the built Python package in a fresh virtualenv (`pip install ipfs-pay-to-pin-client`) and calling `client.pin_file(...)` to successfully pin a file and return the IPFS CID and gateway URL.

**Acceptance Scenarios**:

1. **Given** a Python environment with `ipfs-pay-to-pin-client` installed, **When** a developer initializes `IpfsPayToPinClient(mnemonic="...")` and passes file bytes or a filepath, **Then** the client executes the x402 HTTP challenge-response payment flow and returns a structured dictionary/dataclass containing `ipfs_cid`, `gateway_url`, `expires_at`, and `ttl_days`.
2. **Given** a rekeyed Algorand wallet, **When** the developer initializes `IpfsPayToPinClient(mnemonic="...", sender="ASSET_HOLDER_ADDRESS")`, **Then** the client generates the payment transaction with `sender` set to the asset holder and signs it using the authorized key.
3. **Given** a payment requirement higher than `max_price_usdc`, **When** `client.pin_file()` is invoked, **Then** the client raises an `InsufficientBudgetError` before signing or broadcasting any transaction.

---

### User Story 2 - Automated Post-Release CI Pipeline (Priority: P2)

As a repository maintainer, I want creating and publishing a GitHub Release (e.g. `v1.2.0`) to trigger a `post-release.yml` workflow that automatically builds, tests, and publishes BOTH the NPM TypeScript package and the PyPI Python package using the release's version tag.

**Why this priority**: Triggering package publishing strictly upon GitHub Release publication (`on: release: types: [published]`) ensures human oversight, prevents accidental git tag pushes from publishing broken packages, and guarantees formal release notes exist for every published package version.

**Independent Test**: Can be tested by publishing a GitHub Release for tag `v*` and verifying that the `post-release.yml` workflow triggers, extracting the tag version, building both SDKs, and publishing them via OIDC Trusted Publishing.

**Acceptance Scenarios**:

1. **Given** a newly published GitHub Release, **When** the `post-release.yml` workflow triggers on `release.types: [published]`, **Then** it extracts the tag version (e.g., `1.2.0`), builds both TypeScript and Python SDKs, and publishes them to npm and PyPI via OIDC token exchange.
2. **Given** a raw git tag pushed to the remote without a GitHub Release, **When** no release is published, **Then** package publishing workflows do NOT fire automatically.

---

### Edge Cases

- How does the Python SDK handle network connectivity failures during the HTTP 402 challenge? *Client raises a clear `GatewayError` with the underlying HTTP status code and response body.*
- What happens if the user passes invalid Base64 or invalid 25-word mnemonics? *Client validates mnemonic checksum before network calls and raises a `ValueError`.*
- How does the client handle missing optional dependencies (e.g. LangChain)? *The core SDK has zero heavy dependencies (only `requests` and `py-algorand-sdk`), while LangChain / OpenAI integration wrappers are exported as optional submodules or extras.*

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a native Python package named `ipfs-pay-to-pin-client` located in `python-sdk/`.
- **FR-002**: Python SDK MUST expose an `IpfsPayToPinClient` class supporting configuration for `mnemonic`, `sender` (rekeyed account support), `gateway_url`, `network` (`mainnet`/`testnet`), `max_price_usdc`, and `confirm_price` callback.
- **FR-003**: Python SDK MUST implement the full x402 HTTP challenge-response protocol: receiving `402 Payment Required`, parsing the AVM requirement headers, constructing & signing the Algorand asset transfer transaction, and resubmitting with `PAYMENT-SIGNATURE`.
- **FR-004**: Python SDK MUST export `pin_file()`, `pin_bytes()`, `get_status()`, and `renew_pin()` methods matching the TypeScript SDK capability.
- **FR-005**: Python SDK MUST include typed exception classes: `InsufficientBudgetError`, `PaymentDeclinedError`, `GatewayError`, and `x402ProtocolError`.
- **FR-006**: Repository MUST include a GitHub Actions workflow `.github/workflows/post-release.yml` configured to trigger on `release: types: [published]` (and `workflow_dispatch`), publishing both NPM and PyPI packages via OIDC Trusted Publishing.
- **FR-007**: Python SDK MUST be configurable via `pyproject.toml` using standard build backends (`hatchling` or `flit_core`) and include comprehensive type annotations (PEP 561 `py.typed`).

### Key Entities

- **IpfsPayToPinClient**: Main Python entrypoint class handling network requests, x402 challenge parsing, and Algorand transaction signing.
- **PinResponse**: Dataclass / Pydantic model representing successful pin responses (`status`, `cid`, `ipfs_cid`, `gateway_url`, `pinned_at`, `expires_at`, `ttl_days`, `renewal_url`).
- **PyPI Release Workflow**: GitHub Action executing on `push.tags: ['v*']` that builds wheel/sdist and publishes to PyPI using PyPI Trusted Publisher (OIDC).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can install the client via `pip install ipfs-pay-to-pin-client` in under 10 seconds.
- **SC-002**: Python client pins a file to IPFS via Algorand Mainnet/Testnet in < 3 seconds total execution time.
- **SC-003**: Automated CI pipeline publishes both NPM and PyPI releases within 2 minutes of pushing a version tag.
- **SC-004**: 100% feature parity between TypeScript SDK and Python SDK (including rekeyed wallets, budget caps, and price confirmation callbacks).

## Assumptions

- PyPI project `ipfs-pay-to-pin-client` will be registered with GitHub OIDC Trusted Publisher under the `IcanBENCHurCAT/ipfs-pay-to-pin` repository.
- Python 3.9+ runtime support is targeted.
- `py-algorand-sdk` (`algosdk`) and `requests` are the only core required dependencies.
