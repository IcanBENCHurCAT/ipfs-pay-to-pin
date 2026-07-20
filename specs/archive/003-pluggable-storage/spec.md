# Feature Specification: AB-PP-003 (Pluggable Storage & Mock Adapter)

**Feature Branch**: `003-pluggable-storage`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "As a test suite runner, I want a pluggable storage interface with a local file storage mock, so that I can test the API and client flows without active cloud credentials or network latency."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abstract Storage Interface (Priority: P1)

As a developer, I want to define a generic, abstract base interface for storage operations, so that I can implement and swap different storage providers (such as IPFS/Pinata, GCS, or Local Mock) without modifying the core API route handler.

**Why this priority**: Lays the foundation for pluggable architecture. Allows clean segregation of API routes from vendor-specific storage APIs.

**Independent Test**: Define the storage interface, mock the API route using a minimal implementation, and verify that the API interacts with the interface method signatures correctly.

**Acceptance Scenarios**:

1. **Given** the abstract base storage class exists, **When** examining its class structure, **Then** it defines abstract methods for `store_file(content: bytes, filename: str) -> str` and `file_exists(identifier: str) -> bool`.
2. **Given** a new storage adapter, **When** subclassing the base class, **Then** it enforces implementation of the abstract methods at runtime.

---

### User Story 2 - Mock Local Storage Adapter (Priority: P1)

As a test runner or local developer, I want to configure the gateway to use a mock local storage adapter that writes files directly to a local directories, so that I can run the application and test flows locally without active Pinata credentials or network latency.

**Why this priority**: Extremely important for local development and offline test suites. Prevents dependence on third-party APIs during testing.

**Independent Test**: Configure the storage provider to 'local' in development, upload a file, complete transaction verification, and assert that the file has been correctly written to the configured local mock storage path.

**Acceptance Scenarios**:

1. **Given** the application is configured to use mock local storage, **When** a verified file upload is finalized, **Then** the file is written to the configured mock storage path on the local disk.
2. **Given** the local storage file exists, **When** calling `file_exists` with its unique identifier, **Then** the method returns `True`.

### Edge Cases

- What happens if the configured mock directory is not writeable or does not exist?
- How does the system handle duplicate filenames under mock local storage?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define an abstract base class `BaseStorage` in `gateway/storage.py` defining abstract methods for storing and checking files.
- **FR-002**: System MUST implement `LocalStorage` subclassing `BaseStorage` that writes uploaded files to a local directory defined in configuration settings.
- **FR-003**: System MUST support selecting the active storage adapter (e.g., `local` vs other engines) via the environment settings `STORAGE_PROVIDER`.
- **FR-004**: System MUST automatically initialize the configured storage provider on gateway startup.
- **FR-005**: System MUST integrate the storage provider instance into the `/api/v1/verify` route, storing the cached file upon successful payment validation.

### Key Entities

- **BaseStorage**: Abstract base class defining interface contracts.
- **LocalStorage**: Implementation of `BaseStorage` managing file storage in the local filesystem.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Switching the `STORAGE_PROVIDER` configuration initializes the corresponding adapter seamlessly without application restart.
- **SC-002**: Local storage operations complete in under 50ms without making any external HTTP requests.
- **SC-003**: All uploaded files are saved with a predictable, verifiable filename on the local disk.

## Assumptions

- Mock storage directory defaults to `tmp/mock_storage` if not specified.
- The return value of the local storage `store_file` method is a mock IPFS CID style string or filename for compatibility.
