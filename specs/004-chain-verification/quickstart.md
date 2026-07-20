# Quickstart: Validation Guide for Chain Verification

This guide outlines how to manually test the transaction verification indexer.

## Prerequisites
- A running instance of the gateway server (`uvicorn gateway.main:app --reload`).
- An active `algod` node connection (LocalNet via `algokit localnet start` or TestNet).
- An Algorand wallet with funds to make real/test transactions.

## Validation Scenarios

### 1. Verify a Successful Payment
1. Upload a file to generate a `402 Payment Required` challenge, taking note of the `reference_id`, `amount`, and `escrow_address`.
2. Submit an Algorand transaction sending the exact `amount` to `escrow_address` with the `reference_id` in the transaction note.
3. Wait a few seconds for the transaction to be broadcasted, and copy its `txn_id`.
4. Submit the verification request:
   ```bash
   curl -X POST http://localhost:8000/api/v1/verify \
     -H "Content-Type: application/json" \
     -d '{"reference_id": "YOUR_REF_ID", "txn_id": "YOUR_TXN_ID"}'
   ```
5. **Expected Outcome**: HTTP 200 OK with the IPFS CID. The block latency polling should smoothly handle any slight delay in block finality.

### 2. Verify Double-Spend Rejection
1. Take the exact same `txn_id` used in the successful payment above.
2. Generate a new file upload challenge and get a new `reference_id`.
3. Attempt to submit the old `txn_id` to satisfy the new challenge:
   ```bash
   curl -X POST http://localhost:8000/api/v1/verify \
     -H "Content-Type: application/json" \
     -d '{"reference_id": "NEW_REF_ID", "txn_id": "YOUR_TXN_ID"}'
   ```
4. **Expected Outcome**: HTTP 400 Bad Request with a message indicating a double-spend attempt or invalid note reference.

### 3. Verify Insufficient Amount
1. Generate a file upload challenge requiring 500,000 microALGOs.
2. Submit a transaction sending only 10,000 microALGOs with the correct note.
3. Submit the verification request.
4. **Expected Outcome**: HTTP 402 Payment Required indicating the payment was insufficient.
