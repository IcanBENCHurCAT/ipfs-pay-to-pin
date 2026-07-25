import requests
import json

GOPLAUSIBLE_URL = "https://facilitator.goplausible.xyz"
ESCROW_ADDRESS = "ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY"

def check_goplausible():
    print("Checking GoPlausible public API endpoints...")
    
    # Check endpoints
    endpoints_to_try = [
        f"{GOPLAUSIBLE_URL}/api/merchants",
        f"{GOPLAUSIBLE_URL}/api/providers",
        f"{GOPLAUSIBLE_URL}/api/merchants/c4f55ee4a1a2ae08",
        f"{GOPLAUSIBLE_URL}/api/stats",
        f"{GOPLAUSIBLE_URL}/api/leaderboard",
        f"{GOPLAUSIBLE_URL}/receipt/MYU27QYCNPQVB3IJHL53RX6WU5K7AAC6F7BXVR27DGNDK3HROSJQ",
        f"{GOPLAUSIBLE_URL}/api/receipt/MYU27QYCNPQVB3IJHL53RX6WU5K7AAC6F7BXVR27DGNDK3HROSJQ"
    ]
    
    for url in endpoints_to_try:
        try:
            r = requests.get(url, timeout=5)
            print(f"GET {url} -> Status {r.status_code}")
            if r.status_code == 200:
                try:
                    data = r.json()
                    print("  Response:", json.dumps(data)[:300])
                except Exception:
                    print("  Text:", r.text[:200])
        except Exception as e:
            print(f"GET {url} -> Error: {e}")

if __name__ == "__main__":
    check_goplausible()
