import os
import base64
from algosdk.v2client import algod
from algosdk.logic import get_application_address
from dotenv import load_dotenv

load_dotenv()

def check_status():
    network = os.getenv("ALGORAND_NETWORK", "mainnet").lower()
    default_algod = "https://mainnet-api.algonode.cloud" if network == "mainnet" else "https://testnet-api.algonode.cloud"
    algod_address = os.getenv("ALGOD_ADDRESS", default_algod)
    algod_token = os.getenv("ALGOD_TOKEN", "")
    
    default_app = "3650633378" if network == "mainnet" else "767583704"
    app_id = int(os.getenv("ESCROW_APP_ID", default_app))
    escrow_address = os.getenv("ESCROW_ADDRESS", "")
    usdc_id = int(os.getenv("USDC_ASSET_ID", "31566704" if network == "mainnet" else "10458941"))

    if app_id == 0:
        print("ERROR: ESCROW_APP_ID must be set in your .env file.")
        return

    client = algod.AlgodClient(algod_token, algod_address)

    if not escrow_address:
        escrow_address = get_application_address(app_id)

    # 1. Fetch account balances (ALGO & USDC)
    algo_balance = 0.0
    available_algo = 0.0
    micro_balance = 0
    available_micro = 0
    usdc_balance = 0.0
    usdc_micro = 0

    try:
        acct_info = client.account_info(escrow_address)
        micro_balance = acct_info.get("amount", 0)
        min_balance = acct_info.get("min-balance", 100000)
        available_micro = max(0, micro_balance - min_balance)
        algo_balance = micro_balance / 1_000_000
        available_algo = available_micro / 1_000_000

        for a in acct_info.get("assets", []):
            if a["asset-id"] == usdc_id:
                usdc_micro = a["amount"]
                usdc_balance = usdc_micro / 1_000_000
                break
    except Exception as e:
        print(f"Error fetching balance for {escrow_address}: {e}")

    # 2. Fetch contract global state (base_price, byte_price, owner)
    base_price, byte_price, owner = 1000, 1, "N/A"
    try:
        app_info = client.application_info(app_id)
        global_state = app_info.get("params", {}).get("global-state", [])

        for state in global_state:
            key_bytes = base64.b64decode(state["key"])
            key_str = key_bytes.decode("utf-8", errors="ignore")
            val = state["value"]
            if key_str == "base_price":
                base_price = val.get("uint", base_price)
            elif key_str == "byte_price":
                byte_price = val.get("uint", byte_price)
            elif key_str == "owner":
                from algosdk import encoding
                raw_bytes = base64.b64decode(val.get("bytes", ""))
                if len(raw_bytes) == 32:
                    owner = encoding.encode_address(raw_bytes)
    except Exception as e:
        print(f"Error fetching contract state for App ID {app_id}: {e}")

    print("=" * 55)
    print(f"      IPFS PAY-TO-PIN ESCROW STATUS ({network.upper()})      ")
    print("=" * 55)
    print(f"App ID:            {app_id}")
    print(f"Escrow Address:    {escrow_address}")
    print(f"Contract Owner:    {owner}")
    print("-" * 55)
    print(f"ALGO Total:        {algo_balance:.6f} ALGO ({micro_balance:,} microALGOs)")
    print(f"ALGO Withdrawable: {available_algo:.6f} ALGO ({available_micro:,} microALGOs)")
    print(f"USDC Balance:      ${usdc_balance:.4f} USDC ({usdc_micro:,} microUSDC) [ASA {usdc_id}]")
    print("-" * 55)
    print(f"Base Fee:          {base_price} units ({base_price/1_000_000:.6f} ALGO/USDC)")
    print(f"Per-Byte Fee:      {byte_price} unit/byte ({byte_price*1_000_000/1_000_000:.6f} ALGO/MB)")
    print("=" * 55)

if __name__ == "__main__":
    check_status()
