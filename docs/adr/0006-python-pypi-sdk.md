# v0006: Python PyPI Client SDK & Dual-Publish CI Pipeline

This document details the architectural decisions made during the implementation of the Python PyPI Client SDK (`ipfs-pay-to-pin-client`) and automated dual-publishing GitHub Actions workflow.

---

## Status
Approved / Implemented

## Context & Problem
Python developers and AI agent framework creators require a clean, native Python client SDK to pin files and raw bytes to the IPFS Pay-to-Pin microUSDC gateway without manually handling raw HTTP 402 challenge response parsing or Algorand transaction construction. Additionally, maintainers require an automated release CI pipeline to build and publish both NPM and PyPI client packages upon release creation.

## Decision
1. **Python Client Library (`python-sdk/`)**:
   - Implemented `IpfsPayToPinClient` using `requests` and `py-algorand-sdk` (`algosdk`).
   - Handles standard `PAYMENT-REQUIRED` (HTTP 402) base64 header challenge parsing, builds and signs `AssetTransferTxn` microUSDC payments, and passes transaction bytes in `PAYMENT-SIGNATURE`.
   - Built-in security guardrails: Account rekey verification before signing (`RekeyDetectedError`) and price safety ceilings (`max_price_usdc`).
   - Dataclass models (`PinResponse`) and custom error hierarchy (`PaymentRequiredError`, `ExceedsMaxPriceError`, etc.).
   - Standard PEP 561 compliance marker (`py.typed`) with `hatchling` packaging backend.

2. **Automated Post-Release Dual Publishing (`.github/workflows/post-release.yml`)**:
   - Configured GitHub Actions workflow triggering on `release: types: [published]` and `workflow_dispatch`.
   - Publishes `ipfs-pay-to-pin-client` to PyPI using trusted OIDC authentication via `pypa/gh-action-pypi-publish`.
   - Publishes `@x402/ipfs-pay-to-pin` NPM package to npmjs registry.

## Consequences
- Python-based AI agents and scripts can now pin files to IPFS with full microUSDC automated settlement in 1-2 lines of Python code.
- Publishing releases to PyPI and NPM is fully automated without manual credential management.
- Requires maintenance of both TypeScript and Python client SDKs as new gateway endpoints or x402 standards evolve.

## Superseded Decisions
None
