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

MNEMONIC_STR = "[REDACTED_MNEMONIC]"
USDC_ID = 31566704

def test_prod_flow():
    # 1. Generate test image
    img = Image.new('RGB', (16, 16), color='gold')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_bytes = buffer.getvalue()
    print(f"Created gold badge image: {len(img_bytes)} bytes")

    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    sender_address = account.address_from_private_key(private_key)
    print(f"Sender Address: {sender_address}")

    client = algod.AlgodClient("", MAINNET_ALGOD)

    # 2. Request Pin (POST /api/v1/pin)
    print(f"\n1. Sending Pin Request to Production Gateway ({PROD_URL}/api/v1/pin)...")
    resp = requests.post(
        f"{PROD_URL}/api/v1/pin",
        files={"file": ("gold_badge.png", img_bytes, "image/png")}
    )

    print(f"Response Status Code: {resp.status_code}")
    if resp.status_code != 402:
        print(f"ERROR: Expected 402, got {resp.status_code}: {resp.text}")
        return

    data = resp.json()
    amount = data["amount"]
    escrow_address = data["escrow"]
    ref_id = data["reference_id"]
    asset_id = data.get("asset_id", USDC_ID)
    x402_spec = data.get("x402_spec", {})

    print("\n" + "="*60)
    print("VERIFYING PROD 402 PAYMENT CHALLENGE & GOPLAUSIBLE ROUTING:")
    print("="*60)
    print(f" - Version:        {x402_spec.get('version')}")
    print(f" - Amount:         {amount} microUSDC (${amount/1e6:.4f} USD)")
    print(f" - Asset ID:       {x402_spec.get('asset')}")
    print(f" - Facilitator:    {x402_spec.get('facilitator')}")
    print(f" - Escrow Address: {escrow_address}")
    print(f" - Reference ID:   {ref_id}")
    print("="*60)

    # 3. Create & sign USDC AssetTransferTxn
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

    # 4. Verify via Gateway (Gateway auto-proxies settlement to GoPlausible /settle)
    print("\n2. Sending Verification Payload (with raw_signed_b64) to Gateway...")
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
        print("PROD END-TO-END VERIFICATION & SETTLEMENT SUCCESSFUL!")
        print("="*60)
        print(f"IPFS CID:    {v_data.get('ipfs_cid') or v_data.get('cid')}")
        print(f"Gateway URL: {v_data.get('gateway_url')}")
        print("="*60)

if __name__ == "__main__":
    test_prod_flow()
