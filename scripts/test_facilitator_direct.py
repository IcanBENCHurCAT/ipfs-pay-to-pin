import json
import base64
import requests
import time
from algosdk import account, transaction
from algosdk.v2client import algod

ALGOD_ADDRESS = "https://mainnet-api.algonode.cloud"
algod_client = algod.AlgodClient("", ALGOD_ADDRESS)

# Use the sender address and mnemonic from test_white_square.py
SENDER_MNEMONIC = ""
from algosdk import mnemonic
sender_private_key = mnemonic.to_private_key(SENDER_MNEMONIC)
sender_address = account.address_from_private_key(sender_private_key)

url = "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/pin"
print("1. Getting 402 challenge...")
response = requests.post(url, files={"file": ("test.png", b"123")})
x402_spec = json.loads(base64.b64decode(response.headers["PAYMENT-REQUIRED"]))
accepts = x402_spec["accepts"][0]

print("2. Constructing payment...")
params = algod_client.suggested_params()
txn = transaction.PaymentTxn(
    sender=sender_address,
    sp=params,
    receiver=accepts["payTo"],
    amt=int(accepts["amount"]),
    note=b""
)
signed_txn = txn.sign(sender_private_key)
from algosdk import encoding
raw_signed_b64 = base64.b64encode(base64.b64decode(encoding.msgpack_encode(signed_txn))).decode("utf-8")

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
if "extensions" in x402_spec:
    payment_payload["extensions"] = x402_spec["extensions"]
if "resource" in x402_spec:
    payment_payload["resource"] = x402_spec["resource"]

facilitator_url = "https://facilitator.goplausible.xyz/settle"
# Try the path that the @x402/core uses:
print(f"3. Calling Facilitator: {facilitator_url}")
req_body = {
    "scheme": "exact",
    "network": accepts["network"],
    "x402Version": 2,
    "paymentPayload": payment_payload,
    "paymentRequirements": x402_spec,
    "request": {
        "url": url,
        "method": "POST"
    }
}
r = requests.post(facilitator_url, json=req_body)
print("Status:", r.status_code)
print("Headers:", r.headers)
print("Body:", r.text)

if r.headers.get("EXTENSION-RESPONSES"):
    print("EXTENSION-RESPONSES:", json.dumps(json.loads(base64.b64decode(r.headers.get("EXTENSION-RESPONSES"))), indent=2))
