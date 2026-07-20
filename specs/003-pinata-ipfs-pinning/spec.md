# Feature Specification: Pinata IPFS Pinning Integration

**Feature Branch**: `003-pinata-ipfs-pinning`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "As a Web3 gateway operator, I want my storage adapter to forward uploads to Pinata's API, so that verified files are permanently pinned to the decentralized IPFS network."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pin upload to Pinata after valid payment verification (Priority: P1)

As a Web3 gateway operator, I want verified uploads to be sent to Pinata so that the files are pinned permanently on IPFS.

**Why this priority**: Core value of the gateway to host verified uploads securely on IPFS via a professional pinning service.

**Independent Test**: Upload a file with a valid payment txn, check that the gateway returns a CID, and verify the file is retrievable on a public IPFS gateway.

**Acceptance Scenarios**:

1. **Given** a client has paid the required gateway fee and has a valid payment txn hash, **When** they submit verification for pinning, **Then** the storage adapter forwards the file to Pinata and returns the IPFS CID.
2. **Given** the gateway is configured to use the Pinata storage adapter, **When** a pinning request is verified, **Then** the file content is uploaded to the Pinata pinning endpoint using authorized headers.

---

### User Story 2 - Handle Pinata Pinning Failures gracefully (Priority: P2)

As a Web3 gateway operator, I want external pinning failures (due to API down, invalid JWT, or rate limits) to return meaningful errors to the client rather than hanging or leaking system keys.

**Why this priority**: Prevents user frustration and allows retries.

**Independent Test**: Simulate a Pinata API failure (e.g. 500 error or 401 unauthorized) and check that the gateway responds with a clean error message and appropriate HTTP status.

**Acceptance Scenarios**:

1. **Given** the Pinata API returns a 401 Unauthorized status, **When** a user verifies a payment, **Then** the server logs the error and returns a 502 Bad Gateway to the user indicating a configuration issue.
2. **Given** the Pinata API is down (5xx response), **When** a user verifies a payment, **Then** the server returns a 503 Service Unavailable indicating pinning service is temporarily unavailable.

---

### Edge Cases

- **Large file uploads**: What happens when files exceed the limits of the gateway or Pinata's body size limits?
- **Invalid JWT/Keys**: How does the system handle missing or expired JWT keys without exposing them in response bodies?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST implement a Pinata storage adapter that integrates with Pinata's `pinFileToIPFS` API.
- **FR-002**: The system MUST configure the Pinata storage adapter using a JWT token from environment settings.
- **FR-003**: The storage adapter MUST be selectable via configuration (`STORAGE_ADAPTER=pinata`).
- **FR-004**: The storage adapter MUST return a standard CIDv1 (or CIDv0) identifier returned from Pinata.
- **FR-005**: All external HTTP calls to Pinata's API MUST fail gracefully and not expose sensitive API keys or JWTs in public error logs or responses.

### Key Entities *(include if feature involves data)*

- **StorageAdapter**: Abstract interface representing pinning providers.
- **PinataAdapter**: Implementation of StorageAdapter targeting Pinata's REST API.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of verified uploads are forwarded to Pinata within 5 seconds under normal network conditions.
- **SC-002**: System does not leak the configured `PINATA_JWT` in any log output or client HTTP response body.
- **SC-003**: Service returns standard JSON format containing the IPFS CID upon successful pinning.

## Assumptions

- Gateway operator has a valid Pinata API account with sufficient pinning quotas.
- Pinata API behaves in accordance with their standard `pinFileToIPFS` REST documentation.
- Mocking Pinata's API response is sufficient for local testing suite execution to avoid external dependencies.
