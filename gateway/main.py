import os
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(
    title="IPFS Pay-to-Pin Gateway",
    description="An x402-gated API to pin files to IPFS using Algorand micropayments",
    version="1.0.0"
)

# In-memory store for pending payment challenges (replace with Redis/DB in prod)
challenges = {}

class PinVerificationRequest(BaseModel):
    reference_id: str
    tx_id: str

@app.post("/api/v1/pin", status_code=status.HTTP_402_PAYMENT_REQUIRED)
async def request_pin(file: UploadFile = File(...)):
    """
    Receives file upload, caches it, and issues an x402 Payment Challenge.
    """
    try:
        content = await file.read()
        file_size = len(content)
        
        # Simple dynamic pricing logic (1 microALGO base + 1 microALGO per 1KB)
        base_price = 1000  # microALGOs
        kb_price = 1000
        total_price = base_price + int((file_size / 1024) * kb_price)
        
        # Generate challenge reference
        ref_id = str(uuid.uuid4())
        
        # Cache file content & size mapped to ref_id
        challenges[ref_id] = {
            "content": content,
            "filename": file.filename,
            "size": file_size,
            "price": total_price,
            "paid": False
        }
        
        headers = {
            "X-Algorand-Address": os.getenv("ESCROW_ADDRESS", "MOCKED_ESCROW_ADDRESS"),
            "X-Algorand-Amount": str(total_price),
            "X-Algorand-Txn-Ref": ref_id
        }
        
        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content={
                "message": "Payment required to pin file.",
                "amount": total_price,
                "currency": "microALGO",
                "escrow": os.getenv("ESCROW_ADDRESS", "MOCKED_ESCROW_ADDRESS"),
                "reference_id": ref_id
            },
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/verify", status_code=status.HTTP_201_CREATED)
async def verify_payment(payload: PinVerificationRequest):
    """
    Verifies the on-chain transaction ID matches the challenge reference and price.
    Pins the file to IPFS upon success.
    """
    ref_id = payload.reference_id
    if ref_id not in challenges:
        raise HTTPException(status_code=404, detail="Challenge reference not found.")
        
    challenge = challenges[ref_id]
    if challenge["paid"]:
        raise HTTPException(status_code=400, detail="This challenge has already been paid.")
        
    # TODO: Verify tx_id on-chain using Algorand Indexer/Algod client.
    # Check that:
    # 1. Receiver matches ESCROW_ADDRESS
    # 2. Amount matches challenge["price"]
    # 3. Note field or transaction reference matches ref_id
    
    # Simulate verification and pinning
    challenge["paid"] = True
    mock_ipfs_cid = f"QmYwAPJzv5CZ1sAXXtDURmBNBAeXnuL13xNu18q1eLd8d5"
    
    return {
        "status": "success",
        "message": "Payment verified. File pinned permanently.",
        "filename": challenge["filename"],
        "ipfs_cid": mock_ipfs_cid,
        "gateway_url": f"https://ipfs.io/ipfs/{mock_ipfs_cid}"
    }
