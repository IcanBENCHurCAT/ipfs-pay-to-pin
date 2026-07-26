import os
import sys
import json
import base64
import requests
from PIL import Image
from io import BytesIO
from algosdk import mnemonic, account, transaction, encoding
from algosdk.v2client import algod

PROD_URL = "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com"
MAINNET_ALGOD = "https://mainnet-api.algonode.cloud"

IMAGE_PATH = r"C:\Users\Garret\.gemini\antigravity\brain\d4a572dd-cd12-4d2c-be9d-e572a6f4a696\x402_trophy_avatar_1785010876363.jpg"
MNEMONIC_STR = "[REDACTED_MNEMONIC]"
USDC_ID = 31566704

def main():
    if not os.path.exists(IMAGE_PATH):
        print(f"ERROR: Image file not found at {IMAGE_PATH}")
        return

    # 1. Compress image to < 1MB
    img = Image.open(IMAGE_PATH)
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    img_bytes = buffer.getvalue()
    
    print(f"Original Image Size: {len(img_bytes)} bytes ({len(img_bytes) / 1024:.2f} KB)")
    if len(img_bytes) > 1_000_000:
        img.thumbnail((800, 800))
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=75)
        img_bytes = buffer.getvalue()
        print(f"Compressed Image Size: {len(img_bytes)} bytes ({len(img_bytes) / 1024:.2f} KB)")

    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    sender_address = account.address_from_private_key(private_key)
    print(f"Sender Address: {sender_address}")

    client = algod.AlgodClient("", MAINNET_ALGOD)

    # 2. Request Pin (POST /api/v1/pin)
    print(f"\nSending Holographic Trophy image to {PROD_URL}/api/v1/pin...")
    resp = requests.post(
        f"{PROD_URL}/api/v1/pin",
        files={"file": ("x402_trophy_avatar.jpg", img_bytes, "image/jpeg")}
    )

    print(f"Response Status Code: {resp.status_code}")
    if resp.status_code != 402:
        print(f"Unexpected response ({resp.status_code}): {resp.text}")
        return

    data = resp.json()
    amount = data["amount"]
    escrow_address = data["escrow"]
    ref_id = data["reference_id"]
    asset_id = data.get("asset_id", USDC_ID)
    x402_spec = data.get("x402_spec", {})

    print("\n" + "="*60)
    print("402 PAYMENT CHALLENGE RECEIVED:")
    print("="*60)
    print(f" - Version:        {x402_spec.get('version')}")
    print(f" - Amount:         {amount} microUSDC (${amount/1e6:.4f} USD)")
    print(f" - Asset ID:       {asset_id}")
    print(f" - Tag:            {x402_spec.get('tag')}")
    print(f" - Escrow Address: {escrow_address}")
    print(f" - Reference ID:   {ref_id}")
    print("="*60)

    # 3. Construct USDC AssetTransferTxn (axfer) on Mainnet
    params = client.suggested_params()
    note_bytes = ref_id.encode("utf-8")
    txn = transaction.AssetTransferTxn(
        sender=sender_address,
        sp=params,
        receiver=escrow_address,
        amt=amount,
        index=asset_id,
        note=note_bytes
    )
    signed_txn = txn.sign(private_key)
    raw_signed_b64 = encoding.msgpack_encode(signed_txn)

    # 4. Verify & Auto-Settle via Gateway
    print("\nSubmitting verification payload to production gateway...")
    verify_resp = requests.post(
        f"{PROD_URL}/api/v1/verify",
        json={
            "reference_id": ref_id,
            "raw_signed_b64": raw_signed_b64
        }
    )

    print(f"Verification Status Code: {verify_resp.status_code}")
    v_data = verify_resp.json()
    print("Verification Response:", json.dumps(v_data, indent=2))

    if verify_resp.status_code in (200, 201):
        print("\n" + "="*60)
        print("HOLOGRAPHIC TROPHY PINNED TO IPFS SUCCESSFULLY!")
        print("="*60)
        print(f"IPFS CID:    {v_data.get('ipfs_cid') or v_data.get('cid')}")
        print(f"Gateway URL: {v_data.get('gateway_url')}")
        print("="*60)

if __name__ == "__main__":
    main()
