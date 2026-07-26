import requests
import json
import base64

PROD_URL = "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/pin"

def verify_headers():
    print(f"Checking HTTP 402 headers from {PROD_URL}...")
    resp = requests.post(
        PROD_URL,
        files={"file": ("test.txt", b"header_check", "text/plain")}
    )

    print(f"Response Status Code: {resp.status_code}")
    if resp.status_code != 402:
        print(f"Unexpected status: {resp.text}")
        return

    payment_header = resp.headers.get("PAYMENT-REQUIRED") or resp.headers.get("X-Payment-Required")
    print(f"\nRaw Base64 PAYMENT-REQUIRED Header:\n{payment_header}")

    if payment_header:
        decoded_bytes = base64.b64decode(payment_header)
        decoded_json = json.loads(decoded_bytes.decode("utf-8"))
        print("\n" + "="*60)
        print("DECODED x402 HEADER JSON PAYLOAD:")
        print("="*60)
        print(json.dumps(decoded_json, indent=2))
        print("="*60)

        tag = decoded_json.get("tag")
        tags = decoded_json.get("tags", [])
        if tag == "x402-global-challenge" or "x402-global-challenge" in tags:
            print("\n✅ CONFIRMED: 'tag': 'x402-global-challenge' IS PRESENT IN THE 402 HEADER!")
        else:
            print(f"\n❌ WARNING: Tag 'x402-global-challenge' not found. Found: {tag}")

if __name__ == "__main__":
    verify_headers()
