import os
import sys
import json
import base64
import requests
from PIL import Image
from io import BytesIO
from algosdk import mnemonic, account, transaction
from algosdk.v2client import algod

MAINNET_HEROKU_URL = "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com"
MAINNET_ALGOD = "https://mainnet-api.algonode.cloud"

IMAGE_PATH = r"C:\Users\Garret\.gemini\antigravity\brain\d4a572dd-cd12-4d2c-be9d-e572a6f4a696\ipfs_pay_to_pin_logo_1785003427236.jpg"
MNEMONIC_STR = "REDACTED"

def main():
    if not os.path.exists(IMAGE_PATH):
        print(f"ERROR: Image path {IMAGE_PATH} not found!")
        return

    # 1. Resize/compress image to ensure < 1MB
    img = Image.open(IMAGE_PATH)
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    img_bytes = buffer.getvalue()
    
    print(f"Image Size: {len(img_bytes)} bytes ({len(img_bytes) / 1024:.2f} KB)")
    if len(img_bytes) > 1_000_000:
        img.thumbnail((800, 800))
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=75)
        img_bytes = buffer.getvalue()
        print(f"Compressed Image Size: {len(img_bytes)} bytes ({len(img_bytes) / 1024:.2f} KB)")

    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    sender_address = account.address_from_private_key(private_key)
    print(f"Sender Wallet Address: {sender_address}")

    client = algod.AlgodClient("", MAINNET_ALGOD)

    # Check sender balance
    account_info = client.account_info(sender_address)
    print(f"Sender Mainnet Balance: {account_info['amount'] / 1e6:.6f} ALGO ({account_info['amount']} microALGOs)")

    # 2. Request Pin (POST /api/v1/pin)
    print(f"Sending pin request to {MAINNET_HEROKU_URL}/api/v1/pin...")
    resp = requests.post(
        f"{MAINNET_HEROKU_URL}/api/v1/pin",
        files={"file": ("ipfs_pay_to_pin_logo.jpg", img_bytes, "image/jpeg")}
    )

    print(f"Response Status: {resp.status_code}")
    if resp.status_code != 402:
        print(f"Unexpected response code {resp.status_code}: {resp.text}")
        return

    data = resp.json()
    amount_microalgos = data["amount"]
    escrow_address = data["escrow"]
    ref_id = data["reference_id"]

    print(f"Payment Challenge Received!")
    print(f" - Amount: {amount_microalgos} microALGOs ({amount_microalgos / 1e6:.6f} ALGO)")
    print(f" - Escrow Address: {escrow_address}")
    print(f" - Reference ID: {ref_id}")

    # Check Escrow balance to see if funding MBR (0.1 ALGO) is needed
    escrow_info = client.account_info(escrow_address)
    escrow_balance = escrow_info["amount"]
    print(f"Escrow Account Current Balance: {escrow_balance} microALGOs")

    pay_amount = amount_microalgos
    if escrow_balance + amount_microalgos < 100_000:
        # Top up enough so that escrow balance is at least 200,000 microALGOs (satisfying MBR)
        shortfall = 200_000 - escrow_balance
        print(f"Escrow balance below MBR. Adding top-up of {shortfall} microALGOs ({shortfall / 1e6:.6f} ALGO)...")
        pay_amount = max(amount_microalgos, shortfall)

    params = client.suggested_params()
    note_bytes = ref_id.encode("utf-8")
    txn = transaction.PaymentTxn(
        sender=sender_address,
        sp=params,
        receiver=escrow_address,
        amt=pay_amount,
        note=note_bytes
    )

    signed_txn = txn.sign(private_key)
    tx_id = signed_txn.get_txid()
    print(f"Submitting Payment Txn to Mainnet... Tx ID: {tx_id}")

    client.send_transaction(signed_txn)
    print("Waiting for Mainnet transaction confirmation...")
    confirmed = transaction.wait_for_confirmation(client, tx_id, 5)
    print(f"Payment Confirmed in round: {confirmed['confirmed-round']}")

    # 4. Verify & Pin (POST /api/v1/verify)
    print("Submitting verification request to Heroku Mainnet...")
    verify_resp = requests.post(
        f"{MAINNET_HEROKU_URL}/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": tx_id}
    )

    print(f"Verify Response Status: {verify_resp.status_code}")
    verify_data = verify_resp.json()
    print("Verify Response Payload:", json.dumps(verify_data, indent=2))

    if verify_resp.status_code in (200, 201):
        print("\n" + "="*60)
        print("SUCCESS! FILE PINNED TO IPFS ON MAINNET")
        print("="*60)
        print(f"IPFS CID: {verify_data.get('ipfs_cid') or verify_data.get('cid')}")
        print(f"Gateway URL: {verify_data.get('gateway_url')}")
        print("="*60)

if __name__ == "__main__":
    main()
