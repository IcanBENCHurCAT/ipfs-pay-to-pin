import os
import base64
from algosdk.v2client import algod
from algosdk.logic import get_application_address
from dotenv import load_dotenv

load_dotenv()

def check_status():
    algod_address = os.getenv("ALGOD_ADDRESS", "https://testnet-api.algonode.cloud")
    algod_token = os.getenv("ALGOD_TOKEN", "")
    app_id = int(os.getenv("ESCROW_APP_ID", "0"))
    escrow_address = os.getenv("ESCROW_ADDRESS", "")

    if app_id == 0:
        print("ERROR: ESCROW_APP_ID must be set in your .env file.")
        return

    client = algod.AlgodClient(algod_token, algod_address)

    if not escrow_address:
        escrow_address = get_application_address(app_id)

    # Fetch account balance
    try:
        acct_info = client.account_info(escrow_address)
        micro_balance = acct_info.get("amount", 0)
        min_balance = acct_info.get("min-balance", 100000)
        available_micro = max(0, micro_balance - min_balance)
        algo_balance = micro_balance / 1_000_000
        available_algo = available_micro / 1_000_000
    except Exception as e:
        print(f"Error fetching balance: {e}")
        algo_balance = 0.0
        available_algo = 0.0

    # Fetch contract global state (base_price, byte_price, owner)
    try:
        app_info = client.application_info(app_id)
        global_state = app_info.get("params", {}).get("global-state", [])
        base_price = 1000
        byte_price = 1
        owner = "N/A"

        for state in global_state:
            key_bytes = base64.b64decode(state["key"])
            key_str = key_bytes.decode("utf-8", errors="ignore")
            val = state["value"]
            if key_str == "base_price":
                base_price = val.get("uint", base_price)
            elif key_str == "byte_price":
                byte_price = val.get("uint", byte_price)
            elif key_str == "owner":
                # Algorand address from bytes
                from algosdk import encoding
                raw_bytes = base64.b64decode(val.get("bytes", ""))
                if len(raw_bytes) == 32:
                    owner = encoding.encode_address(raw_bytes)
    except Exception as e:
        print(f"Error fetching contract info: {e}")
        base_price, byte_price, owner = 1000, 1, "N/A"

    print("=" * 50)
    print("      IPFS PAY-TO-PIN ESCROW CONTRACT STATUS      ")
    print("=" * 50)
    print(f"App ID:            {app_id}")
    print(f"Escrow Address:    {escrow_address}")
    print(f"Contract Owner:    {owner}")
    print("-" * 50)
    print(f"Total Balance:     {algo_balance:.6f} ALGO ({micro_balance:,} microALGOs)")
    print(f"Withdrawable:      {available_algo:.6f} ALGO ({available_micro:,} microALGOs)")
    print("-" * 50)
    print(f"Base Fee:          {base_price} microALGOs ({base_price/1000000:.6f} ALGO)")
    print(f"Per-Byte Fee:      {byte_price} microALGO/byte ({byte_price*1000000/1000000:.6f} ALGO/MB)")
    print("=" * 50)

if __name__ == "__main__":
    check_status()
