# Phase 1: Quickstart (AB-PP-001)

## Testing and Compilation Commands

```bash
# Run pytest to verify the pricing contract logic (owner validation, rekey protection, pricing updates)
pytest tests/pricing/test_contract.py

# Compile the contract to TEAL and ABI artifacts
algokit compile py src/smart_contracts/pricing/contract.py --out-dir artifacts/
```
