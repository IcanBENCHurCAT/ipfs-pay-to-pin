# v1: Pluggable Storage & Mock Adapter

This document details the architectural decisions made during the implementation of the Pluggable Storage & Mock Adapter feature.

---

## Status
Approved / Implemented

## Context & Problem
To run local development and automated integration tests offline, the IPFS Pay-to-Pin Gateway required a way to decouple core API routes and transaction verification from vendor-specific IPFS pinning service APIs (e.g., Pinata). The system needed to support multiple storage engines that can be configured dynamically without code changes.

## Decision
1. **Abstract Base Interface**: Created `BaseStorage` inside `gateway/storage.py` defining abstract method signatures for `store_file(content: bytes, filename: str) -> str` and `file_exists(identifier: str) -> bool`.
2. **Local Storage Mock**: Developed `LocalStorage` implementing `BaseStorage` that writes uploads directly to the local filesystem (configured via `LOCAL_STORAGE_DIR`).
3. **Mock Content-Addressed CIDs**: Rather than static mocks, `LocalStorage` computes the SHA-256 hash of the content, encodes it to base32 (lowercase, unpadded), and uses this hash as the content identifier (CID), matching IPFS CID format standards.
4. **Dynamic Provider Factory**: Implemented `get_storage_provider()` loading configuration settings from the environment to dynamically initialize the active storage adapter.
5. **API Integration**: Linked the active storage provider into `/api/v1/verify` to write files on disk upon successful payment validation.

## Consequences
* **Positive**:
  - Decoupled code architecture allowing new adapters (GCS, AWS S3, Pinata API) to be added without touching API route logic.
  - Fast, offline testing capabilities with no external network latency or API credential dependencies.
  - Accurate content-addressed CID generation verifying upload integrity.
* **Negative**:
  - Mock mode writes to local disk, requiring cleanup management in tests.
  - Does not validate remote pinning API client authorization when running in mock local mode.

## Superseded Decisions
None.
