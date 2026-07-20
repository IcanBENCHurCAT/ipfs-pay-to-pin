# Feature Specification: AB-PP-001 (Pricing & Configuration Contract)

**Feature Branch**: `001-pricing-contract`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "As a gateway operator, I want to deploy an Algorand smart contract (algopy) that securely manages base-price and per-byte pricing, so that my service fee structure is on-chain, auditable, and easily adjustable."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Pricing Variables (Priority: P1)

As a gateway operator (contract owner), I want to update the Base Price and Byte Price securely, so that I can adjust my service fees based on market conditions.

**Why this priority**: Without adjustable pricing, the service fee structure is rigid and cannot respond to changes in ALGO valuation or storage costs.

**Independent Test**: Can be fully tested by simulating an owner account updating the variables and verifying the state changes, as well as testing a non-owner account failing to update them.

**Acceptance Scenarios**:

1. **Given** I am the owner of the contract, **When** I submit a transaction to update the Base Price and Byte Price, **Then** the contract state reflects the new pricing values.
2. **Given** I am NOT the owner of the contract, **When** I submit a transaction to update the pricing, **Then** the transaction is rejected.

### User Story 2 - Prevent Account Takeover (Priority: P1)

As a gateway operator, I want to ensure that any critical contract method verifies that the account's rekey status remains unmodified, so that malicious actors cannot take over the contract account.

**Why this priority**: Security is paramount; preventing account takeover protects the funds and the integrity of the pricing configuration.

**Independent Test**: Can be fully tested by attempting to submit a transaction that includes a `rekey_to` modification.

**Acceptance Scenarios**:

1. **Given** a valid contract method call, **When** the transaction attempts to modify `Txn.rekey_to()`, **Then** the transaction is rejected.
2. **Given** a valid contract method call, **When** the transaction leaves `Txn.rekey_to()` as `Account(0)`, **Then** the transaction proceeds.

### Edge Cases

- What happens when pricing variables are set to zero or negative values?
- How does system handle concurrent requests to update pricing?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a smart contract written in Algorand Python (`algopy`) and compiled using Puya compiler.
- **FR-002**: System MUST allow the contract owner to securely set and update a Base Price (in microALGOs).
- **FR-003**: System MUST allow the contract owner to securely set and update a Byte Price (in microALGOs/byte).
- **FR-004**: System MUST verify that `Txn.rekey_to()` remains unmodified (`Account(0)`) in all critical methods to prevent account takeover.
- **FR-005**: System MUST reject any attempts by non-owners to modify the pricing variables.

### Key Entities

- **Pricing Contract**: The on-chain entity that holds the configurable Base Price and Byte Price and enforcing authorization controls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The contract is successfully deployed and the owner can update pricing without error.
- **SC-002**: 100% of unauthorized attempts to update pricing are rejected.
- **SC-003**: 100% of transactions attempting a `rekey_to` attack on critical methods are rejected.

## Assumptions

- Gateway operator has a secure means of managing the owner wallet keys.
- The contract will be integrated into the IPFS Pay-to-Pin Gateway backend which will read these state variables.
