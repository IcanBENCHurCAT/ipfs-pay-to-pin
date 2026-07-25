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
GOPLAUSIBLE_URL = "https://facilitator.goplausible.xyz"
MAINNET_ALGOD = "https://mainnet-api.algonode.cloud"

MNEMONIC_STR = "sheriff cruise oxygen air eagle hungry spread yard gun case drift screen enhance alley ostrich spike door engage harsh order flush scale tennis about runway"
USDC_ID = 31566704
CAIP2_NETWORK = "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="

def main():
    img = Image.new('RGB', (10, 10), color='purple')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_bytes = buffer.getvalue()

    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    sender_address = account.address_from_private_key(private_key)

    client = algod.AlgodClient("", MAINNET_ALGOD)

    # 1. Request Pin
    print(f"Requesting pin challenge from {HEROKU_MAINNET_URL}/api/v1/pin...")
    resp = requests.post(
        f"{HEROKU_MAINNET_URL}/api/v1/pin",
        files={"file": ("purple_dot.png", img_bytes, "image/png")}
    )
    data = resp.json()
    amount = data["amount"]
    escrow_address = data["escrow"]
    ref_id = data["reference_id"]
    asset_id = data.get("asset_id", USDC_ID)

    print(f"Challenge received: Amount={amount} microUSDC (${amount/1e6:.4f}), Ref={ref_id}")

    # 2. Build signed USDC transaction
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

    common_payload = {
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
            "asset": str(asset_id),
            "reference": ref_id,
            "resourceUrl": f"{HEROKU_MAINNET_URL}/api/v1/pin",
            "method": "POST"
        }
    }

    # 3. Call GoPlausible /verify
    print("\n1. Calling GoPlausible /verify...")
    gp_v_resp = requests.post(f"{GOPLAUSIBLE_URL}/verify", json=common_payload)
    print(f"GoPlausible /verify ({gp_v_resp.status_code}):", json.dumps(gp_v_resp.json(), indent=2))

    # 4. Call GoPlausible /settle
    print("\n2. Calling GoPlausible /settle...")
    gp_s_resp = requests.post(f"{GOPLAUSIBLE_URL}/settle", json=common_payload)
    print(f"GoPlausible /settle ({gp_s_resp.status_code}):", json.dumps(gp_s_resp.json(), indent=2))

    # 5. Broadcast to Algod if not settled by GoPlausible
    if not gp_s_resp.json().get("success"):
        print("\nBroadcasting directly to Algod...")
        try:
            client.send_transaction(signed_txn)
            transaction.wait_for_confirmation(client, tx_id, 4)
            print("Confirmed on Algod!")
        except Exception as e:
            print(f"Algod broadcast status: {e}")

    # 6. Finalize pin with gateway
    print("\n3. Finalizing pin with Heroku Gateway...")
    gw_resp = requests.post(
        f"{HEROKU_MAINNET_URL}/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": tx_id}
    )
    print(f"Gateway Verify ({gw_resp.status_code}):", json.dumps(gw_resp.json(), indent=2))

if __name__ == "__main__":
    main()
