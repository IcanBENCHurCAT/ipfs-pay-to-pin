# v2: Pricing & Configuration Contract (AB-PP-001)

This document details the architectural decisions made during the implementation of the Pricing & Configuration Contract feature.

---

## Status
Approved / Implemented

## Context & Problem
To enable flexible billing for the IPFS pay-to-pin service, the gateway owner needed a way to manage storage fee structures (flat base fee and rate per byte) dynamically, securely, and transparently on-chain.

## Decision
1. **Contract Language & Engine**: Developed the smart contract (`PayToPinEscrow`) in Algorand Python (`algopy`) targeting AVM 12+ compiled via Puya compiler (`puyapy 5.8.1`).
2. **Access Control**: Stored the owner address in global state (`self.owner`) upon contract creation. Enforced `assert Txn.sender == self.owner.value` on modification.
3. **Rekey Protection**: Asserted `Txn.rekey_to == Global.zero_address` in all state-modifying contract methods to prevent malicious account takeovers.
4. **Dynamic Configuration**: Exposed `update_pricing(new_base, new_byte_price)` and `withdraw_fees(amount, receiver)` to manage rates and sweep accumulated ALGO using inner payment transactions.

## Consequences
* **Positive**:
  - Secure and transparent fee configuration auditing.
  - Hardened against rekeying hijacking vulnerabilities.
  - Simplified withdrawal workflow for treasury payouts.
* **Negative**:
  - Requires on-chain transactions and network fees to update pricing variables.

## Superseded Decisions
None.
