import os
import uuid
import time
from fastapi import FastAPI, UploadFile, File, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from gateway.config import settings
from gateway.payment import get_pricing, verify_transaction
from gateway.storage import get_storage_adapter, StorageException
from gateway.database import (
    init_db,
    is_transaction_processed,
    record_transaction,
    create_challenge,
    get_challenge,
    update_challenge_status
)


app = FastAPI(
    title="IPFS Pay-to-Pin Gateway",
    description="An x402-gated API to pin files to IPFS using Algorand micropayments",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    init_db()


# Initialize storage adapter
storage_adapter = get_storage_adapter()

# Caches for challenges
challenges = {}

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

        # Create challenge in SQLite database
        create_challenge(
            reference_id=ref_id,
            expected_amount=total_price,
            escrow_address=settings.ESCROW_ADDRESS,
            ttl_seconds=600
        )

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

    # 1. Validate challenge reference exists in-memory cache
    if ref_id not in challenges:
        raise HTTPException(status_code=404, detail="Challenge reference not found.")

    challenge = challenges[ref_id]

    # Retrieve challenge metadata from database
    db_challenge = get_challenge(ref_id)
    if not db_challenge:
        raise HTTPException(status_code=404, detail="Challenge reference not found.")

    # 2. Check if challenge is expired
    import datetime
    expires_at_dt = datetime.datetime.fromisoformat(db_challenge["expires_at"])
    if datetime.datetime.utcnow() > expires_at_dt:
        update_challenge_status(ref_id, "EXPIRED")
        raise HTTPException(status_code=404, detail="Challenge reference not found.")

    # Check if challenge was already paid
    if db_challenge["status"] == "VERIFIED" or challenge["paid"]:
        raise HTTPException(status_code=400, detail="This challenge has already been paid.")

    # 3. Prevent double spend of transaction ID
    if is_transaction_processed(tx_id):
        raise HTTPException(status_code=400, detail="Double-spend detected: Transaction already processed.")

    # 4. Verify transaction properties on-chain
    is_valid, sender, error_reason = verify_transaction(
        tx_id=tx_id,
        expected_amount=challenge["price"],
        expected_receiver=settings.ESCROW_ADDRESS,
        expected_reference=ref_id
    )

    if not is_valid:
        if error_reason and "Insufficient payment" in error_reason:
            raise HTTPException(status_code=402, detail=error_reason)
        if error_reason and "Transaction not found" in error_reason:
            raise HTTPException(status_code=404, detail=error_reason)
        update_challenge_status(ref_id, "REJECTED")
        raise HTTPException(status_code=400, detail=error_reason or "Transaction verification failed.")

    # Mark as completed
    challenge["paid"] = True
    update_challenge_status(ref_id, "VERIFIED")
    record_transaction(
        txn_id=tx_id,
        sender=sender or "UNKNOWN",
        receiver=settings.ESCROW_ADDRESS,
        amount=challenge["price"],
        reference_id=ref_id
    )

    # Pin file content using configured storage adapter
    try:
        ipfs_cid = await storage_adapter.pin_file(
            content=challenge["content"],
            filename=challenge["filename"]
        )
    except StorageException as e:
        # Revert paid status if pinning failed so they can retry verification
        challenge["paid"] = False
        update_challenge_status(ref_id, "PENDING")
        from gateway.database import get_db_connection
        conn = get_db_connection()
        conn.execute("DELETE FROM processed_transactions WHERE txn_id = ?", (tx_id,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        challenge["paid"] = False
        update_challenge_status(ref_id, "PENDING")
        from gateway.database import get_db_connection
        conn = get_db_connection()
        conn.execute("DELETE FROM processed_transactions WHERE txn_id = ?", (tx_id,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Unexpected pinning error: {str(e)}")

    return {
        "status": "success",
        "message": "Payment verified. File pinned permanently.",
        "filename": challenge["filename"],
        "ipfs_cid": ipfs_cid,
        "cid": ipfs_cid,
        "gateway_url": f"https://ipfs.io/ipfs/{ipfs_cid}"
    }



