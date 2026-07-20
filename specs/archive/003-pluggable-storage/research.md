# Research: Pluggable Storage & Mock Adapter (AB-PP-003)

This document addresses design choices, patterns, and decisions for implementing pluggable storage engines and a local filesystem mock storage adapter.

## 1. Technical Unknowns & Decisions

### 1.1 Storage Interface Abstraction
- **Decision**: Define a formal abstract base class `BaseStorage` using Python's standard `abc` module.
- **Methods**:
  - `store_file(content: bytes, filename: str) -> str`: Stores the file content and returns a unique identifier (CID or path/key).
  - `file_exists(identifier: str) -> bool`: Checks if a file with the given identifier exists in the storage provider.
- **Rationale**: Python's `abc.ABC` and `@abstractmethod` decorator enforce interface conformance at subclass instantiation time, preventing runtime errors later.

### 1.2 Storage Provider Selector (`STORAGE_PROVIDER`)
- **Decision**: Add `STORAGE_PROVIDER` and `LOCAL_STORAGE_DIR` to the `Settings` class in `gateway/config.py`.
- **Options**: `local` (default/mock) and `pinata` (external IPFS).
- **Rationale**: Centralizing configuration in `gateway/config.py` allows easy environment overrides via `.env` or system environment variables.

### 1.3 Mock CID Generation Algorithm
- **Decision**: Generate a deterministic mock CIDv1-like string for local storage files. We will hash the file content using SHA-256 and encode it in base32 to mimic a real CID (e.g. `bafybeih...`).
- **Rationale**: Using content-addressing logic mirrors how IPFS behaves, ensuring that duplicate files result in the same identifier and avoid unnecessary writes.

### 1.4 Directory Creation & Error Handling
- **Decision**: Upon initialization, `LocalStorage` will attempt to create the target directory (`tmp/mock_storage`) if it does not exist using `os.makedirs(..., exist_ok=True)`. If the path exists but is not writeable (or creation fails), the application will raise a configuration exception during startup.
- **Rationale**: Failing fast on startup prevents silent upload failures.

### 1.5 FastAPI Integration Pattern
- **Decision**: Define a helper function `get_storage() -> BaseStorage` that instantiates/returns the configured storage adapter. We will initialize the selected provider once at application startup and reuse it.
- **Rationale**: Keeps API route handlers clean and decoupled from the active storage implementation.

---

## 2. Alternatives Considered

### Alternative A: Return the Raw Filename for Local Mock
- **Pros**: Simple to map directly to disk.
- **Cons**: Does not match the IPFS CID structure, requiring routes/clients to handle different formats.
- **Decision**: Rejected in favor of hashing the file to generate an IPFS-style CID.

### Alternative B: Dynamic Adapter Selection on Every Request
- **Pros**: High flexibility.
- **Cons**: Performance overhead, and it's unnecessary since storage engine choice is a system-wide deployment setting.
- **Decision**: Rejected in favor of application-level startup initialization.
