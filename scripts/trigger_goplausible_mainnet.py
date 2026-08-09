import os
import sys
import json
import base64
import requests
from PIL import Image
from io import BytesIO
from algosdk import mnemonic, account, transaction, encoding
from algosdk.v2client import algod

HEROKU_MAINNET_URL = "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com"
GOPLAUSIBLE_FACILITATOR_URL = "https://facilitator.goplausible.xyz"
MAINNET_ALGOD = "https://mainnet-api.algonode.cloud"

MNEMONIC_STR = ""

def main():
    # 1. Create tiny 10x10 test image
    img = Image.new('RGB', (10, 10), color='cyan')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_bytes = buffer.getvalue()
    print(f"Created small test image: {len(img_bytes)} bytes")

    # 2. Get x402 challenge from gateway
    print(f"Requesting pin challenge from {HEROKU_MAINNET_URL}/api/v1/pin...")
    resp = requests.post(
        f"{HEROKU_MAINNET_URL}/api/v1/pin",
        files={"file": ("test_dot.png", img_bytes, "image/png")}
    )
    if resp.status_code != 402:
        print(f"Unexpected status: {resp.status_code} {resp.text}")
        return

    data = resp.json()
    amount_microalgos = data["amount"]
    escrow_address = data["escrow"]
    ref_id = data["reference_id"]
    x402_spec = data.get("x402_spec", {})

    print(f"Challenge received:")
    print(f" - Amount: {amount_microalgos} microALGOs")
    print(f" - Escrow Address: {escrow_address}")
    print(f" - Reference ID: {ref_id}")

    # 3. Submit transaction on Algorand Mainnet
    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    sender_address = account.address_from_private_key(private_key)

    client = algod.AlgodClient("", MAINNET_ALGOD)
    params = client.suggested_params()
    note_bytes = ref_id.encode("utf-8")

    txn = transaction.PaymentTxn(
        sender=sender_address,
        sp=params,
        receiver=escrow_address,
        amt=amount_microalgos,
        note=note_bytes
    )

    signed_txn = txn.sign(private_key)
    tx_id = signed_txn.get_txid()
    raw_signed_b64 = encoding.msgpack_encode(signed_txn)

    print(f"Submitting Txn to Mainnet... Tx ID: {tx_id}")
    client.send_transaction(signed_txn)
    print("Waiting for Mainnet confirmation...")
    confirmed = transaction.wait_for_confirmation(client, tx_id, 5)
    print(f"Confirmed in round: {confirmed['confirmed-round']}")

    # 4. Trigger GoPlausible Facilitator /verify endpoint to auto-catalog merchant address
    print("\nTriggering GoPlausible Facilitator /verify endpoint...")
    verify_payload = {
        "paymentPayload": {
            "x402Version": 1,
            "scheme": "exact",
            "network": "algorand-mainnet",
            "payload": {
                "paymentGroup": [raw_signed_b64],
                "paymentIndex": 0
            }
        },
        "paymentRequirements": {
            "x402Version": 1,
            "scheme": "exact",
            "network": "algorand-mainnet",
            "payTo": escrow_address,
            "amount": str(amount_microalgos),
            "asset": 0,
            "reference": ref_id,
            "resourceUrl": f"{HEROKU_MAINNET_URL}/api/v1/pin",
            "method": "POST"
        }
    }





    try:
        gp_resp = requests.post(
            f"{GOPLAUSIBLE_FACILITATOR_URL}/verify",
            json=verify_payload,
            headers={"Content-Type": "application/json"}
        )
        print(f"GoPlausible /verify Status ({gp_resp.status_code}):", gp_resp.text)
    except Exception as e:
        print(f"Error posting to GoPlausible: {e}")

    # 5. Verify with our Heroku Gateway API to finish pinning
    print("\nVerifying with IPFS Gateway API to finalize pin...")
    verify_resp = requests.post(
        f"{HEROKU_MAINNET_URL}/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": tx_id}
    )

    print(f"Gateway Verify Status ({verify_resp.status_code}):", verify_resp.text)

if __name__ == "__main__":
    main()
