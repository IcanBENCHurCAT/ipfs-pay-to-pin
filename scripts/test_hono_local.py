import requests
import json
import base64

LOCAL_URL = "http://localhost:4021/api/v1/pin"

def test_hono_local():
    print(f"Testing local @x402/hono server at {LOCAL_URL}...")
    try:
        resp = requests.post(
            LOCAL_URL,
            files={"file": ("test.png", b"test_hono_content", "image/png")}
        )
    except Exception as e:
        print(f"Error connecting to local server: {e}")
        return

    print(f"Response Status Code: {resp.status_code}")
    print("\nResponse Headers:")
    for k, v in resp.headers.items():
        if "402" in k.lower() or "payment" in k.lower():
            print(f" - {k}: {v[:100]}...")

    payment_header = resp.headers.get("PAYMENT-REQUIRED") or resp.headers.get("X-PAYMENT-REQUIRED") or resp.headers.get("X-Payment-Required")
    if payment_header:
        print("\nDecoded PAYMENT-REQUIRED Header from @x402/hono middleware:")
        try:
            decoded = json.loads(base64.b64decode(payment_header).decode("utf-8"))
            print(json.dumps(decoded, indent=2))
        except Exception as e:
            print(f"Decode error: {e}")

    try:
        print("\nResponse Body:")
        print(json.dumps(resp.json(), indent=2))
    except Exception:
        print("Text:", resp.text)

if __name__ == "__main__":
    test_hono_local()
