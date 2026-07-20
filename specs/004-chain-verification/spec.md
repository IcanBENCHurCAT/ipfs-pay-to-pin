# Feature Specification: Production Chain Verification Indexer

**Feature Branch**: `[###-chain-verification]`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "AB-PP-005: Production Chain Verification Indexer
  * As a production gateway host, I want the transaction verification indexer to query live testnet/mainnet node providers (via `algokit-utils`), handle block latency, and double-check transaction notes, so that I prevent double-spend or spoofed payment bypasses."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Payment Verification (Priority: P1)

As a gateway host, I want the system to reliably query live blockchain nodes to verify payments so that attackers cannot bypass payment requirements using fake or double-spent transactions.

**Why this priority**: Correct payment verification is the core functionality of the "Pay-to-Pin" gateway. Without it, the service can be exploited.

**Independent Test**: Can be fully tested by submitting a valid transaction ID from the network and confirming it is recognized, as well as submitting a re-used or spoofed transaction and confirming it is rejected.

**Acceptance Scenarios**:

1. **Given** a valid payment transaction on the live network that correctly matches the required amount and reference in the note, **When** the transaction ID is submitted for verification, **Then** the system should successfully verify the payment and proceed with pinning.
2. **Given** a transaction ID of a payment that has already been used for a previous upload, **When** the transaction ID is submitted again, **Then** the system should reject the verification as a double-spend.
3. **Given** a transaction ID of a payment that has an incorrect transaction note or insufficient amount, **When** the transaction ID is submitted, **Then** the system should reject the verification.

---

### User Story 2 - Handling Block Latency (Priority: P2)

As a gateway host, I want the verification system to gracefully handle network delays and block latency so that legitimate user payments are not prematurely rejected before they are confirmed on-chain.

**Why this priority**: Blockchain networks inherently have block finality latency. If the system checks too quickly, valid payments might be missed, leading to a poor user experience.

**Independent Test**: Can be tested by submitting a transaction and immediately requesting verification, ensuring the system waits appropriately for block confirmation rather than instantly failing.

**Acceptance Scenarios**:

1. **Given** a valid payment transaction has just been broadcasted to the network, **When** the verification is requested before the block is finalized, **Then** the system should wait or retry until the block is confirmed, up to a reasonable timeout.
2. **Given** a verification request for a transaction that never confirms, **When** the timeout is reached, **Then** the system should reject the verification.

### Edge Cases

- What happens when the primary Algorand node provider is temporarily unreachable or rate-limiting requests?
- How does the system handle transaction verification if the transaction is valid but the network experiences an unexpected chain reorganization (though rare in Algorand)?
- What happens if the transaction note format is slightly malformed but contains the correct reference?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST query live Algorand node providers (TestNet or MainNet) to fetch transaction details using the provided transaction ID.
- **FR-002**: System MUST verify that the transaction amount is strictly greater than or equal to the required micropayment amount for the specific file size.
- **FR-003**: System MUST verify that the transaction receiver is the correct escrow address configured for the gateway.
- **FR-004**: System MUST parse the transaction note field and verify that it contains the exact `reference_id` generated during the `402 Payment Required` challenge.
- **FR-005**: System MUST maintain a registry of processed transaction IDs to detect and reject double-spend attempts.
- **FR-006**: System MUST implement a polling or retry mechanism to wait for block confirmation if a submitted transaction ID is not immediately found on the network.
- **FR-007**: System MUST support configurable fallbacks or timeouts for node provider queries to handle network instability.

### Key Entities

- **Transaction Record**: Represents an on-chain transaction, including its ID, sender, receiver, amount, and note.
- **Verification Challenge**: The internal record of a pending file upload waiting for payment, including the expected `reference_id`, amount, and expiration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of attempted double-spend transactions using previously verified transaction IDs are rejected.
- **SC-002**: 100% of transactions with an incorrect `reference_id` in the note are rejected.
- **SC-003**: Valid transactions are verified successfully within 10 seconds of block finality, accounting for block latency.
- **SC-004**: The system can handle at least 50 concurrent verification requests without overwhelming the configured node provider limits.

## Assumptions

- The underlying Algorand node infrastructure (e.g., via `algokit-utils`) provides reliable and timely transaction data.
- The node provider rate limits are sufficient for the expected gateway traffic.
- Transactions are considered final once they are included in a block (standard Algorand behavior).
