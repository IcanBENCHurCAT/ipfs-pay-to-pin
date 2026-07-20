# Phase 0: Research (AB-PP-001)

## Design Decisions

- **Compiler & Language**: Algorand Python (`algopy`) and compiled using Puya compiler targeting AVM 12+ as per Constitution.
- **Access Control**: Owner address will be stored in global state upon contract creation. Any state-modifying methods must verify that the sender is the owner.
- **Rekey Protection**: All critical methods will include an assertion to verify that `Txn.rekey_to() == Account(0)` to prevent account takeover.
- **Dynamic Pricing Formula**: The contract will manage base-price (uint64) and per-byte pricing (uint64) via global state variables.
