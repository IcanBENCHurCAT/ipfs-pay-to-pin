# API Contract: Chain Verification Indexer

## Endpoints

### `POST /api/v1/verify`
Verifies an Algorand transaction ID against a pending upload challenge. If successful, finishes the pinning process and returns the CID.

**Headers**:
- `Content-Type: application/json`

**Request Body**:
```json
{
  "reference_id": "abc123xyz",
  "txn_id": "AB34567890123456789012345678901234567890123456789012"
}
```

**Responses**:

- `200 OK`: Payment verified successfully, file pinned.
  ```json
  {
    "status": "success",
    "cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
  }
  ```

- `400 Bad Request`: Validation error or double-spend detected.
  ```json
  {
    "detail": "Double-spend detected: Transaction already processed."
  }
  ```

- `402 Payment Required`: The transaction is valid but the amount is insufficient for the `reference_id`.
  ```json
  {
    "detail": "Insufficient payment. Expected 50000 microALGOs, received 10000."
  }
  ```

- `404 Not Found`: The `reference_id` is invalid or expired, or the transaction was not found on-chain after polling timeout.
  ```json
  {
    "detail": "Transaction not found on the network."
  }
  ```
