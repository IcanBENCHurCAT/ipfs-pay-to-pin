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

MNEMONIC_STR = "REDACTED"
USDC_ID = 31566704

def test_prod_hono_e2e():
    print(f"1. Requesting Payment Challenge from Production @x402/hono server ({PROD_URL}/api/v1/pin)...")
    img = Image.new('RGB', (100, 100), color='white')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_bytes = buffer.getvalue()
    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
    print(f"Created 1KB White Square Image: {len(img_bytes)} bytes (Base64: {len(img_b64)} chars)")

    json_payload = {
        "filename": "white_square_prod_hono.png",
        "data": img_b64
    }

    resp = requests.post(
        f"{PROD_URL}/api/v1/pin",
        json=json_payload
    )

    print(f"Response Status Code: {resp.status_code}")
    if resp.status_code != 402:
        print(f"Expected 402, got {resp.status_code}: {resp.text}")
        return

    payment_header = resp.headers.get("PAYMENT-REQUIRED") or resp.headers.get("X-PAYMENT-REQUIRED") or resp.headers.get("X-Payment-Required")
    if not payment_header:
        print("ERROR: Missing PAYMENT-REQUIRED header!")
        return

    x402_spec = json.loads(base64.b64decode(payment_header).decode("utf-8"))
    accepts = x402_spec["accepts"][0]
    
    amount = int(accepts["amount"])
    escrow_address = accepts["payTo"]
    asset_id = int(accepts["asset"])

    print("\n" + "="*60)
    print("PRODUCTION @x402/hono CHALLENGE RECEIVED:")
    print("="*60)
    print(f" - Version:        {x402_spec.get('x402Version')}")
    print(f" - Amount:         {amount} microUSDC (${amount/1e6:.4f} USD)")
    print(f" - Asset ID:       {asset_id}")
    print(f" - Tag:            {accepts['extra'].get('tag')}")
    print(f" - Escrow Address: {escrow_address}")
    print("="*60)

    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    sender_address = account.address_from_private_key(private_key)
    print(f"Sender Address: {sender_address}")

    client = algod.AlgodClient("", MAINNET_ALGOD)

    # 2. Create & Sign Mainnet USDC AssetTransferTxn
    params = client.suggested_params()
    txn = transaction.AssetTransferTxn(
        sender=sender_address,
        sp=params,
        receiver=escrow_address,
        amt=amount,
        index=asset_id
    )
    signed_txn = txn.sign(private_key)
    raw_signed_b64 = encoding.msgpack_encode(signed_txn)

    # Construct official x402 V2 PaymentPayload header
    payment_payload = {
        "x402Version": 2,
        "scheme": "exact",
        "network": accepts["network"],
        "accepted": accepts,
        "payload": {
            "paymentGroup": [raw_signed_b64],
            "paymentIndex": 0
        }
    }
    
    # 2.5 Ensure extensions are passed through so the facilitator can index Bazaar metadata
    if "extensions" in challenge:
        payment_payload["extensions"] = challenge["extensions"]

    encoded_payment_payload = base64.b64encode(json.dumps(payment_payload).encode("utf-8")).decode("utf-8")

    # 3. Submit request with official PAYMENT-SIGNATURE header
    pinned_resp = requests.post(
        f"{PROD_URL}/api/v1/pin",
        json=json_payload,
        headers={
            "PAYMENT-SIGNATURE": encoded_payment_payload
        }
    )

    print(f"Response Status Code: {pinned_resp.status_code}")
    rejection_header = pinned_resp.headers.get("PAYMENT-REQUIRED") or pinned_resp.headers.get("X-PAYMENT-REQUIRED") or pinned_resp.headers.get("X-Payment-Required")
    if rejection_header:
        print("\nRejection PAYMENT-REQUIRED Header:")
        print(json.dumps(json.loads(base64.b64decode(rejection_header).decode("utf-8")), indent=2))

    try:
        p_data = pinned_resp.json()
        print("Response Data:", json.dumps(p_data, indent=2))
    except Exception:
        print("Response Text:", pinned_resp.text)

    if pinned_resp.status_code in (200, 201):
        print("\n" + "="*60)
        print("PRODUCTION @x402/hono END-TO-END VERIFICATION & PINNING SUCCESSFUL!")
        print("="*60)
        print(f"IPFS CID:    {p_data.get('ipfs_cid') or p_data.get('cid')}")
        print(f"Gateway URL: {p_data.get('gateway_url')}")
        print("="*60)

if __name__ == "__main__":
    test_prod_hono_e2e()
