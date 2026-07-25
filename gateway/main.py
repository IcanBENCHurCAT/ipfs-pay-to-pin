import os
import uuid
import time
import json
import base64
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, status, BackgroundTasks, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

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

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="IPFS Pay-to-Pin Gateway",
    description="An x402-gated API to pin files to IPFS using Algorand micropayments",
    version="1.0.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.on_event("startup")
def on_startup():
    init_db()
    os.makedirs(settings.TEMP_CHALLENGE_DIR, exist_ok=True)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "IPFS Pay-to-Pin Gateway",
        "network": settings.ALGORAND_NETWORK,
        "docs_url": "/docs"
    }

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
        filepath = challenges[k].get("filepath")
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass
        del challenges[k]

class PinVerificationRequest(BaseModel):
    reference_id: Optional[str] = None
    tx_id: Optional[str] = None
    raw_signed_b64: Optional[str] = None
    paymentPayload: Optional[dict] = None

@app.post("/api/v1/pin", status_code=status.HTTP_402_PAYMENT_REQUIRED)
@limiter.limit(settings.RATE_LIMIT_PIN)
async def request_pin(request: Request, background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Receives file upload, caches it to ephemeral temp disk, and issues an x402 Payment Challenge.
    Enforces maximum file size limit and rate limiting.
    """
    # Evict expired challenges asynchronously
    background_tasks.add_task(cleanup_expired_challenges)

    try:
        content = await file.read()
        file_size = len(content)

        if file_size > settings.MAX_FILE_SIZE_BYTES:
            max_mb = settings.MAX_FILE_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed limit of {max_mb} MB."
            )

        # Retrieve dynamic pricing rates from contract/cache
        base_price, byte_price = get_pricing(settings.ESCROW_APP_ID)
        total_price = base_price + file_size * byte_price

        # Generate a unique challenge reference
        ref_id = str(uuid.uuid4())

        # Save payload to ephemeral temp disk cache to prevent RAM exhaustion
        os.makedirs(settings.TEMP_CHALLENGE_DIR, exist_ok=True)
        filepath = os.path.join(settings.TEMP_CHALLENGE_DIR, f"{ref_id}.tmp")
        with open(filepath, "wb") as f:
            f.write(content)

        challenges[ref_id] = {
            "filepath": filepath,
            "filename": file.filename,
            "size": file_size,
            "price": total_price,
            "paid": False,
            "created_at": time.time()
        }

        # Create challenge in database
        create_challenge(
            reference_id=ref_id,
            expected_amount=total_price,
            escrow_address=settings.ESCROW_ADDRESS,
            ttl_seconds=600
        )

        # Build GoPlausible x402 standard spec using CAIP-2 network format
        network_id = f"algorand-{settings.ALGORAND_NETWORK}"
        if settings.ALGORAND_NETWORK == "mainnet":
            network_id = "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="
        elif settings.ALGORAND_NETWORK == "testnet":
            network_id = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

        x402_spec = {
            "version": "2.0",
            "scheme": "exact",
            "network": network_id,
            "payTo": settings.ESCROW_ADDRESS,
            "amount": str(total_price),
            "asset": str(settings.USDC_ASSET_ID),
            "reference": ref_id,
            "facilitator": "https://facilitator.goplausible.xyz",
            "resourceUrl": f"{request.base_url}api/v1/pin",
            "method": "POST",
            "tag": "x402-global-challenge",
            "tags": ["x402-global-challenge"],
            "name": "IPFS Pay-to-Pin Gateway",
            "resourceName": "IPFS File Pinning Service",
            "provider": "IPFS Pay-to-Pin",
            "merchant": "IPFS Pay-to-Pin",
            "description": "Real-time IPFS file storage & pinning: accepts uploaded files and returns permanent IPFS CID and gateway URL via Algorand USDC micropayments",
            "icon": "https://amber-extensive-crawdad-745.mypinata.cloud/ipfs/QmU9AgYdnWXHYqwsan75kJB8JPudY7kxfiguNHyn69BTiy",
            "image": "https://amber-extensive-crawdad-745.mypinata.cloud/ipfs/QmU9AgYdnWXHYqwsan75kJB8JPudY7kxfiguNHyn69BTiy"
        }

        encoded_spec = base64.b64encode(json.dumps(x402_spec).encode("utf-8")).decode("utf-8")

        # Build HTTP x402 headers
        headers = {
            "PAYMENT-REQUIRED": encoded_spec,
            "X-Payment-Required": encoded_spec,
            "X-Algorand-Address": settings.ESCROW_ADDRESS,
            "X-Algorand-Amount": str(total_price),
            "X-Algorand-Asset": str(settings.USDC_ASSET_ID),
            "X-Algorand-Txn-Ref": ref_id
        }

        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content={
                "message": "Payment required to pin file.",
                "amount": total_price,
                "currency": settings.PAYMENT_CURRENCY,
                "asset_id": settings.USDC_ASSET_ID,
                "escrow": settings.ESCROW_ADDRESS,
                "reference_id": ref_id,
                "x402_spec": x402_spec
            },
            headers=headers
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/verify", status_code=status.HTTP_201_CREATED)
async def verify_payment(
    request: Request,
    payload: Optional[PinVerificationRequest] = None,
    payment_signature: Optional[str] = Header(None, alias="PAYMENT-SIGNATURE"),
    x_payment: Optional[str] = Header(None, alias="X-PAYMENT")
):
    """
    Verifies on-chain transaction matches challenge details.
    Triggers file pinning on success.
    """
    sig_header = payment_signature or x_payment
    ref_id = None
    tx_id = None

    if sig_header:
        try:
            decoded_bytes = base64.b64decode(sig_header)
            decoded_json = json.loads(decoded_bytes.decode("utf-8"))
            ref_id = decoded_json.get("reference") or decoded_json.get("reference_id")
            tx_id = decoded_json.get("txId") or decoded_json.get("txn_id") or decoded_json.get("tx_id")
        except Exception:
            pass

    if not ref_id or not tx_id:
        if payload and payload.reference_id:
            ref_id = payload.reference_id
            tx_id = payload.tx_id
        else:
            raise HTTPException(status_code=400, detail="Missing payment verification reference_id or tx_id.")

    # 1. Validate challenge reference exists in database
    db_challenge = get_challenge(ref_id)
    if not db_challenge:
        raise HTTPException(status_code=404, detail="Challenge reference not found.")

    # 1b. Optional GoPlausible auto-settlement proxying if raw signed txn is provided
    if payload and (payload.raw_signed_b64 or payload.paymentPayload):
        network_id = "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=" if settings.ALGORAND_NETWORK == "mainnet" else "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
        gp_payload = payload.paymentPayload or {
            "paymentPayload": {
                "x402Version": 2,
                "scheme": "exact",
                "network": network_id,
                "payload": {
                    "paymentGroup": [payload.raw_signed_b64],
                    "paymentIndex": 0
                }
            },
            "paymentRequirements": {
                "x402Version": 2,
                "scheme": "exact",
                "network": network_id,
                "payTo": settings.ESCROW_ADDRESS,
                "amount": str(db_challenge["expected_amount"]),
                "asset": str(settings.USDC_ASSET_ID),
                "reference": ref_id,
                "resourceUrl": f"{request.base_url}api/v1/pin",
                "method": "POST",
                "tag": "x402-global-challenge",
                "resourceName": "IPFS File Pinning Service",
                "provider": "IPFS Pay-to-Pin",
                "merchant": "IPFS Pay-to-Pin",
                "description": "Real-time IPFS file storage & pinning: accepts uploaded files and returns permanent IPFS CID and gateway URL via Algorand USDC micropayments",
                "icon": "https://amber-extensive-crawdad-745.mypinata.cloud/ipfs/QmU9AgYdnWXHYqwsan75kJB8JPudY7kxfiguNHyn69BTiy"
            }
        }
        try:
            import requests as req_lib
            settle_res = req_lib.post("https://facilitator.goplausible.xyz/settle", json=gp_payload, timeout=5)
            if settle_res.status_code == 200:
                s_data = settle_res.json()
                if s_data.get("transaction"):
                    tx_id = s_data.get("transaction")
        except Exception:
            pass

    filepath = os.path.join(settings.TEMP_CHALLENGE_DIR, f"{ref_id}.tmp")
    if ref_id in challenges:
        challenge = challenges[ref_id]
    else:
        # Reconstruct challenge from database + disk for multi-worker support
        challenge = {
            "filepath": filepath,
            "filename": f"pinned_{ref_id[:8]}.jpg",
            "price": db_challenge["expected_amount"],
            "paid": db_challenge["status"] == "VERIFIED",
            "created_at": time.time()
        }
        challenges[ref_id] = challenge


    # 2. Check if challenge is expired
    import datetime
    expires_at_dt = datetime.datetime.fromisoformat(db_challenge["expires_at"])
    if expires_at_dt.tzinfo is None:
        expires_at_dt = expires_at_dt.replace(tzinfo=datetime.UTC)
    if datetime.datetime.now(datetime.UTC) > expires_at_dt:
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

    # Retrieve content from disk temp storage or in-memory fallback
    filepath = challenge.get("filepath")
    if filepath and os.path.exists(filepath):
        with open(filepath, "rb") as f:
            file_content = f.read()
    else:
        file_content = challenge.get("content", b"")

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
            content=file_content,
            filename=challenge["filename"]
        )
        # Clean up temp file on successful pin
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass
    except StorageException as e:
        # Revert paid status if pinning failed so they can retry verification
        challenge["paid"] = False
        update_challenge_status(ref_id, "PENDING")
        from gateway.database import delete_transaction
        delete_transaction(tx_id)
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        challenge["paid"] = False
        update_challenge_status(ref_id, "PENDING")
        from gateway.database import delete_transaction
        delete_transaction(tx_id)
        raise HTTPException(status_code=500, detail=f"Unexpected pinning error: {str(e)}")

    return {
        "status": "success",
        "message": "Payment verified. File pinned permanently.",
        "filename": challenge["filename"],
        "ipfs_cid": ipfs_cid,
        "cid": ipfs_cid,
        "gateway_url": f"https://ipfs.io/ipfs/{ipfs_cid}"
    }



