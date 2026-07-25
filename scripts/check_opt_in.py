import os
from algosdk.v2client import algod

MAINNET_ALGOD = "https://mainnet-api.algonode.cloud"
ESCROW_ADDRESS = "GPS22ZCA4JSBY4FSQ5RFBEE56GK476HIMVHP7TCOSLK6KVBJL726CELJW4"
USDC_ID = 31566704

def main():
    client = algod.AlgodClient("", MAINNET_ALGOD)
    info = client.account_info(ESCROW_ADDRESS)
    assets = info.get("assets", [])
    
    print(f"Escrow Account ({ESCROW_ADDRESS}):")
    print(f" - Balance: {info['amount'] / 1e6:.6f} ALGO")
    print(f" - Assets: {len(assets)}")
    
    has_usdc = False
    for asset in assets:
        print(f"   * Asset ID: {asset['asset-id']}, Amount: {asset['amount']}")
        if asset['asset-id'] == USDC_ID:
            has_usdc = True
            
    if not has_usdc:
        print(f"\nEscrow account is NOT opted into USDC ({USDC_ID}).")
    else:
        print(f"\nEscrow account IS opted into USDC ({USDC_ID})!")

if __name__ == "__main__":
    main()
