# Quickstart & Validation Guide: Pluggable Storage & Mock Adapter (AB-PP-003)

This guide describes how to verify the pluggable storage and mock adapter setup locally.

## 1. Prerequisites
- Python 3.12+ installed
- Packages installed: `fastapi`, `uvicorn`, `pydantic`, `pytest`, `httpx` (or standard `TestClient` requirements)
- A `.env` file containing configured parameters or defaults

## 2. Configuration Setup

Verify or configure your `.env` file to select the local mock storage provider:

```ini
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=tmp/mock_storage
```

Ensure any existing test directories are clean:
```bash
rm -rf tmp/mock_storage
```

## 3. End-to-End Validation Scenario

### Step 3.1: Start the FastAPI Server
Run the gateway server locally:
```bash
python -m uvicorn gateway.main:app --reload --port 8000
```

### Step 3.2: Initiate a Pin Challenge
Submit a file for pinning:
```bash
curl -i -X POST -F "file=@tests/test_gateway.py" http://127.0.0.1:8000/api/v1/pin
```

**Expected Response**:
- HTTP Status: `402 Payment Required`
- Headers:
  - `X-Algorand-Address`: The designated escrow address (e.g., `MOCKED_ESCROW_ADDRESS`)
  - `X-Algorand-Amount`: The calculated price in microALGOs
  - `X-Algorand-Txn-Ref`: A UUID string reference
- JSON Body:
  ```json
  {
    "message": "Payment required to pin file.",
    "amount": 12345,
    "currency": "microALGO",
    "escrow": "MOCKED_ESCROW_ADDRESS",
    "reference_id": "YOUR_REFERENCE_UUID"
  }
  ```

### Step 3.3: Submit Transaction Verification
Simulate payment using a mock transaction ID (e.g., `MOCKED_VALID_TX_123`):
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"reference_id": "YOUR_REFERENCE_UUID", "tx_id": "MOCKED_VALID_TX_123"}' \
  http://127.0.0.1:8000/api/v1/verify
```

**Expected Response**:
- HTTP Status: `201 Created`
- JSON Body:
  ```json
  {
    "status": "success",
    "message": "Payment verified. File pinned permanently.",
    "filename": "test_gateway.py",
    "ipfs_cid": "bafybeih...",
    "gateway_url": "https://ipfs.io/ipfs/bafybeih..."
  }
  ```

### Step 3.4: Verify File Exists on Disk
Check that the file has been successfully written to the configured local storage directory:
```bash
ls tmp/mock_storage/
```
You should see a file named with the generated mock IPFS CID (e.g., `bafybeih...`).

---

## 4. Run automated unit/integration tests
Run the pytest suite to verify that the implementation is robust:
```bash
python -m pytest tests/
```
All tests should pass, including new assertions verifying local file system persistence.
