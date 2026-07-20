# Quickstart & Verification: Pinata IPFS Pinning Integration

This guide outlines the scenarios and commands used to verify the Pinata IPFS Pinning integration works end-to-end.

## Scenario 1: Setup & Run Mocked Pinata Integration Test

To verify the integration logic without calling the external service:

```bash
# Run tests to verify the adapter factory behaves correctly
pytest tests/ -v
```

## Scenario 2: End-to-End Pinning with Pinata (Manual Sandbox Test)

To manually run the integration with a real or sandbox Pinata account:

1. Populate your `.env` configuration:
   ```env
   STORAGE_ADAPTER=pinata
   PINATA_JWT=your_real_pinata_jwt_here
   ```
2. Launch the gateway server:
   ```bash
   uvicorn gateway.main:app --reload
   ```
3. Upload a file via `POST /api/v1/pin` to receive the x402 payment challenge.
4. Complete the transaction payment on Algorand LocalNet/TestNet.
5. Verify the payment via `POST /api/v1/verify` submitting the transaction hash, and verify the resulting IPFS CID.
