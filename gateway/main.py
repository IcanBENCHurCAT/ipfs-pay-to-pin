import os
import uuid
import time
from fastapi import FastAPI, UploadFile, File, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from gateway.config import settings
from gateway.payment import get_pricing, verify_transaction

app = FastAPI(
    title="IPFS Pay-to-Pin Gateway",
    description="An x402-gated API to pin files to IPFS using Algorand micropayments",
    version="1.0.0"
)

# Caches for challenges and spent transactions
challenges = {}
spent_txns = set()

# Cleanup task for expired challenges
def cleanup_expired_challenges():
    now = time.time()
    expired_keys = [
        k for k, v in challenges.items()
        if not v["paid"] and now > v["created_at"] + 600  # 10 minutes TTL
    ]
    for k in expired_keys:
        del challenges[k]

class PinVerificationRequest(BaseModel):
    reference_id: str
    tx_id: str

@app.post("/api/v1/pin", status_code=status.HTTP_402_PAYMENT_REQUIRED)
async def request_pin(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Receives file upload, caches it, and issues an x402 Payment Challenge.
    """
    # Evict expired challenges asynchronously
    background_tasks.add_task(cleanup_expired_challenges)

    try:
        content = await file.read()
        file_size = len(content)

        # Retrieve dynamic pricing rates from contract/cache
        base_price, byte_price = get_pricing(settings.ESCROW_APP_ID)
        total_price = base_price + file_size * byte_price

        # Generate a unique challenge reference
        ref_id = str(uuid.uuid4())

        # Cache file content & details mapped to reference_id
        challenges[ref_id] = {
            "content": content,
            "filename": file.filename,
            "size": file_size,
            "price": total_price,
            "paid": False,
            "created_at": time.time()
        }

        # Build custom HTTP x402 headers
        headers = {
            "X-Algorand-Address": settings.ESCROW_ADDRESS,
            "X-Algorand-Amount": str(total_price),
            "X-Algorand-Txn-Ref": ref_id
        }

        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content={
                "message": "Payment required to pin file.",
                "amount": total_price,
                "currency": "microALGO",
                "escrow": settings.ESCROW_ADDRESS,
                "reference_id": ref_id
            },
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/verify", status_code=status.HTTP_201_CREATED)
async def verify_payment(payload: PinVerificationRequest):
    """
    Verifies on-chain transaction matches challenge details.
    Triggers simulated file pinning on success.
    """
    ref_id = payload.reference_id
    tx_id = payload.tx_id

    # 1. Validate challenge reference exists
    if ref_id not in challenges:
        raise HTTPException(status_code=404, detail="Challenge reference not found.")

    challenge = challenges[ref_id]

    # 2. Check if challenge was already paid
    if challenge["paid"]:
        raise HTTPException(status_code=400, detail="This challenge has already been paid.")

    # 3. Prevent double spend of transaction ID
    if tx_id in spent_txns:
        raise HTTPException(status_code=400, detail="Transaction ID has already been spent.")

    # 4. Verify transaction properties on-chain
    is_valid = verify_transaction(
        tx_id=tx_id,
        expected_amount=challenge["price"],
        expected_receiver=settings.ESCROW_ADDRESS,
        expected_reference=ref_id
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail="Transaction verification failed.")

    # Mark as completed
    challenge["paid"] = True
    spent_txns.add(tx_id)

    # Simulated successful pinning output
    mock_ipfs_cid = "QmYwAPJzv5CZ1sAXXtDURmBNBAeXnuL13xNu18q1eLd8d5"

    return {
        "status": "success",
        "message": "Payment verified. File pinned permanently.",
        "filename": challenge["filename"],
        "ipfs_cid": mock_ipfs_cid,
        "gateway_url": f"https://ipfs.io/ipfs/{mock_ipfs_cid}"
    }
