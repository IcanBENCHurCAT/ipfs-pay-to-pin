# Feature Specification: AB-PP-002 (x402 Dynamic Payment Challenge & Local Verification)

**Feature Branch**: `002-payment-challenge`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "As a client application, I want to upload a file to the gateway, receive a standard HTTP 402 challenge with size-calculated fees, and submit an on-chain transaction reference to verify and complete my file write, so that I pay exactly for the resources I use."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dynamic Payment Challenge (Priority: P1)

As a client application, I want to submit a file to `/api/v1/pin` and receive an HTTP 402 challenge with the size-calculated fee and escrow address, so that I know exactly how much to pay and where to send the funds.

**Why this priority**: Core gating mechanism. Without the payment challenge, the gateway cannot enforce payment for pinning requests.

**Independent Test**: Upload a file of a specific size, assert HTTP status code is 402, and verify that response body and headers contain the correct size-calculated fee amount, escrow address, and a unique reference ID.

**Acceptance Scenarios**:

1. **Given** the gateway is running and connected to the pricing contract, **When** a client uploads a file of size \(S\) bytes, **Then** the server returns status `402 Payment Required`.
2. **Given** the 402 response, **When** inspecting the response headers, **Then** the following headers are present:
   - `X-Algorand-Address`: Matching the escrow address.
   - `X-Algorand-Amount`: Matching \( \text{Base Price} + (S \times \text{Byte Price}) \).
   - `X-Algorand-Txn-Ref`: A unique reference string (UUID).
3. **Given** the 402 response, **When** inspecting the JSON body, **Then** it contains the matching `amount`, `escrow` address, and `reference_id`.

---

### User Story 2 - Transaction Verification & Release (Priority: P1)

As a client application, I want to submit my Algorand transaction ID after paying on-chain to `/api/v1/verify`, so that the gateway verifies my payment and finishes pinning my file.

**Why this priority**: Completes the pay-to-pin cycle. Prevents malicious uploads without valid payments.

**Independent Test**: Mock a transaction matching the fee and reference ID on-chain, submit to `/api/v1/verify`, and assert it returns HTTP 201 with the pinned file CID.

**Acceptance Scenarios**:

1. **Given** a pending challenge for reference \(R\) and amount \(A\), **When** a client submits a valid transaction ID that pays \(A\) to the escrow address and references \(R\) in the txn note field, **Then** the payment is verified, the file is pinned, and the server returns status `201 Created` with the CID.
2. **Given** a verification request, **When** the transaction details do not match the expected amount, receiver, or reference, **Then** the request is rejected with `400 Bad Request`.
3. **Given** a verification request, **When** the transaction ID has already been verified for another upload, **Then** the request is rejected with `400 Bad Request` to prevent double-spending.

### Edge Cases

- What happens if the Algorand blockchain has latency and the indexer has not yet seen the transaction?
- How does the system handle concurrent verification calls referencing the same transaction ID?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST query the escrow contract state to retrieve current `base_price` and `byte_price` values.
- **FR-002**: System MUST compute the total fee using the formula: \(\text{Fee} = \text{Base Price} + (\text{Size in Bytes} \times \text{Byte Price})\).
- **FR-003**: System MUST return HTTP 402 status code for unverified file uploads.
- **FR-004**: System MUST include standard `X-Algorand-Address`, `X-Algorand-Amount`, and `X-Algorand-Txn-Ref` headers in the 402 response.
- **FR-005**: System MUST store file content temporarily indexed by the unique reference ID challenge.
- **FR-006**: System MUST verify the payment transaction on the Algorand chain against the expected receiver, amount, and reference ID.
- **FR-007**: System MUST reject double-spend attempts using the same transaction ID.

### Key Entities

- **Challenge**: The temporary cache containing file metadata, file contents, computed fee, and the generated reference ID.
- **Payment Verification Request**: The payload submitted by the client containing the challenge reference ID and the transaction ID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: File uploads without valid payment always return HTTP 402.
- **SC-002**: Payment challenges are generated and returned in under 200ms.
- **SC-003**: 100% of double-spend or mismatched transaction verifications are rejected.
- **SC-004**: Upon successful transaction verification, the client receives the file's canonical IPFS CID.

## Assumptions

- Gateway retrieves pricing info from the escrow contract during startup or via a short-lived cache.
- The verification system will mock node queries in this batch, using local mockup verification.
