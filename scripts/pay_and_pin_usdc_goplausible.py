import os
import sys
import json
import base64
import requests
from PIL import Image
from io import BytesIO
from algosdk import mnemonic, account, transaction, encoding
from algosdk.v2client import algod

MAINNET_HEROKU_URL = "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com"
GOPLAUSIBLE_URL = "https://facilitator.goplausible.xyz"
MAINNET_ALGOD = "https://mainnet-api.algonode.cloud"

MNEMONIC_STR = "sheriff cruise oxygen air eagle hungry spread yard gun case drift screen enhance alley ostrich spike door engage harsh order flush scale tennis about runway"
USDC_ID = 31566704
CAIP2_NETWORK = "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="

def main():
    # 1. Create a small 20x20 badge image
    img = Image.new('RGB', (20, 20), color='teal')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_bytes = buffer.getvalue()
    print(f"Created badge image: {len(img_bytes)} bytes")

    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    sender_address = account.address_from_private_key(private_key)
    print(f"Sender Address: {sender_address}")

    client = algod.AlgodClient("", MAINNET_ALGOD)

    # Check USDC balance
    account_info = client.account_info(sender_address)
    usdc_balance = 0
    for a in account_info.get("assets", []):
        if a["asset-id"] == USDC_ID:
            usdc_balance = a["amount"]
            break
    print(f"Sender USDC Balance: {usdc_balance / 1e6:.6f} USDC ({usdc_balance} microUSDC)")

    # 2. Request Pin (POST /api/v1/pin)
    print(f"Requesting pin challenge from {MAINNET_HEROKU_URL}/api/v1/pin...")
    resp = requests.post(
        f"{MAINNET_HEROKU_URL}/api/v1/pin",
        files={"file": ("goplausible_badge.png", img_bytes, "image/png")}
    )

    print(f"Pin Request Status: {resp.status_code}")
    if resp.status_code != 402:
        print(f"Unexpected status: {resp.text}")
        return

    data = resp.json()
    amount = data["amount"]
    escrow_address = data["escrow"]
    ref_id = data["reference_id"]
    asset_id = data.get("asset_id", USDC_ID)

    print(f"Payment Challenge Received:")
    print(f" - Amount: {amount} microUSDC (${amount / 1e6:.4f} USD)")
    print(f" - Asset ID: {asset_id}")
    print(f" - Escrow Address: {escrow_address}")
    print(f" - Reference ID: {ref_id}")

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
    tx_id = signed_txn.get_txid()
    raw_signed_b64 = encoding.msgpack_encode(signed_txn)

    print(f"Submitting USDC AssetTransferTxn to Mainnet... Tx ID: {tx_id}")
    client.send_transaction(signed_txn)

    print("Waiting for Mainnet transaction confirmation...")
    confirmed = transaction.wait_for_confirmation(client, tx_id, 5)
    print(f"Confirmed in round: {confirmed['confirmed-round']}")

    # 4. Submit Verification Payload to GoPlausible Facilitator /verify
    print("\n" + "="*60)
    print("SUBMITTING VERIFICATION TO GOPLAUSIBLE FACILITATOR...")
    print("="*60)

    gp_verify_payload = {
        "paymentPayload": {
            "x402Version": 2,
            "scheme": "exact",
            "network": CAIP2_NETWORK,
            "payload": {
                "paymentGroup": [raw_signed_b64],
                "paymentIndex": 0
            }
        },
        "paymentRequirements": {
            "x402Version": 2,
            "scheme": "exact",
            "network": CAIP2_NETWORK,
            "payTo": escrow_address,
            "amount": str(amount),
            "asset": asset_id,
            "reference": ref_id,
            "resourceUrl": f"{MAINNET_HEROKU_URL}/api/v1/pin",
            "method": "POST"
        }
    }

    try:
        gp_resp = requests.post(
            f"{GOPLAUSIBLE_URL}/verify",
            json=gp_verify_payload,
            headers={"Content-Type": "application/json"}
        )
        print(f"GoPlausible /verify Status ({gp_resp.status_code}):")
        print(json.dumps(gp_resp.json(), indent=2))
    except Exception as e:
        print(f"GoPlausible request error: {e}")

    # 5. Verify with Heroku Gateway API to finalize pinning
    print("\nVerifying with Heroku Gateway API to finalize pin...")
    verify_resp = requests.post(
        f"{MAINNET_HEROKU_URL}/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": tx_id}
    )

    print(f"Heroku Gateway Verify Status ({verify_resp.status_code}):")
    print(json.dumps(verify_resp.json(), indent=2))

if __name__ == "__main__":
    main()
