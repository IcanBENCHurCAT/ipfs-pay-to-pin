# Phase 0: Outline & Research

## Technical Context Clarifications

- **Language/Version**: Python 3.9+ (as required by spec).
- **Primary Dependencies**: `py-algorand-sdk` for Algorand transactions and crypto, `requests` for HTTP REST calls. Build backends: `hatchling` or `flit_core`.
- **Storage**: N/A (This is a stateless client SDK).
- **Testing**: `pytest` for unit and integration testing.
- **Target Platform**: OS-agnostic Python environments (macOS, Windows, Linux) where AI agents operate.
- **Project Type**: Library/SDK.
- **Performance Goals**: Under 3 seconds execution time per pin (excluding network latency beyond our control).
- **Constraints**: 100% parity with TypeScript SDK. Must not bring heavy dependencies like LangChain into core; those must be optional extras.
- **Scale/Scope**: Handles IPFS pinning with microUSDC payments for AI agents.

## Decisions

- **Decision**: Use `hatchling` as the build backend via `pyproject.toml`.
- **Rationale**: Hatch is modern, fast, and handles versioning and environments elegantly, becoming the standard for new Python projects.
- **Alternatives considered**: `flit_core` (also good, but hatch is more extensible), `setuptools` (legacy).

- **Decision**: Use `requests` for HTTP calls.
- **Rationale**: Ubiquitous in Python ecosystem, simple synchronous API. Async isn't explicitly required by the spec, but we could provide async versions later. For now, `requests` meets the P1 user story of a simple one-liner.
- **Alternatives considered**: `httpx` (would allow both sync and async, but adds dependency footprint. Given zero-heavy dependency constraint, `requests` is standard).

- **Decision**: Implement GitHub OIDC for PyPI publishing.
- **Rationale**: Required by spec (`FR-006`). OIDC is the most secure way to publish to PyPI from GitHub Actions without long-lived tokens.
