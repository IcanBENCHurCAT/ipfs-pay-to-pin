# Quickstart & Verification Guide: AB-PP-002

This guide outlines runnable scenarios to validate the x402 Dynamic Payment Challenge & Local Verification workflow.

## Prerequisites
- Python 3.12+ installed
- Dependencies installed: `pip install -r requirements.txt` (or appropriate virtual environment setup)
- Gateway running locally

---

## 1. Local Development Setup

To start the FastAPI gateway locally:
```bash
# Start the gateway server on port 8000
uvicorn gateway.main:app --reload
```

---

## 2. Validation Scenarios

### Scenario A: Upload File & Receive 402 Challenge
Validate that uploading any file without paying yields an HTTP 402 with appropriate headers and body.

**Command:**
```bash
curl -i -X POST -F "file=@README.md" http://127.0.0.1:8000/api/v1/pin
```

**Expected Response Headers:**
```http
HTTP/1.1 402 Payment Required
content-type: application/json
X-Algorand-Address: <Escrow-Address>
X-Algorand-Amount: <Calculated-microALGOs>
X-Algorand-Txn-Ref: <Reference-UUID>
```

**Expected Response Body:**
```json
{
  "message": "Payment required to pin file.",
  "amount": 1245,
  "currency": "microALGO",
  "escrow": "MOCKED_ESCROW_ADDRESS",
  "reference_id": "766299b8-3e4b-4b2a-a92c-67c42767098e"
}
```

---

### Scenario B: Payment Verification & Success
Validate that submitting a valid transaction ID matching the challenge successfully pins the file.

**Command:**
```bash
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"reference_id": "766299b8-3e4b-4b2a-a92c-67c42767098e", "tx_id": "MOCKED_TX_ID_12345"}' \
  http://127.0.0.1:8000/api/v1/verify
```

**Expected Response:**
```http
HTTP/1.1 201 Created
content-type: application/json
```
```json
{
  "status": "success",
  "message": "Payment verified. File pinned permanently.",
  "filename": "README.md",
  "ipfs_cid": "QmYwAPJzv5CZ1sAXXtDURmBNBAeXnuL13xNu18q1eLd8d5",
  "gateway_url": "https://ipfs.io/ipfs/QmYwAPJzv5CZ1sAXXtDURmBNBAeXnuL13xNu18q1eLd8d5"
}
```

---

### Scenario C: Mismatched or Already Paid Request (Error Handling)
Validate that submitting an invalid transaction reference or a double-spend attempt returns an HTTP 400.

**Command (Duplicate tx_id submission):**
```bash
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"reference_id": "766299b8-3e4b-4b2a-a92c-67c42767098e", "tx_id": "MOCKED_TX_ID_12345"}' \
  http://127.0.0.1:8000/api/v1/verify
```

**Expected Response:**
```http
HTTP/1.1 400 Bad Request
content-type: application/json
```
```json
{
  "detail": "This challenge has already been paid."
}
```

---

## 3. Running Integration Tests

To run the integration tests checking the payment challenge flow:
```bash
python -m pytest tests/ -v
```
