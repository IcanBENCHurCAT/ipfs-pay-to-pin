import os
import sys
from algosdk.v2client import algod
from algosdk import mnemonic, account, abi
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)
from dotenv import load_dotenv

load_dotenv()

def update_pricing(new_base_microusdc: int = 10000, new_byte_price: int = 1):
    network = os.getenv("ALGORAND_NETWORK", "mainnet").lower()
    default_algod = "https://mainnet-api.algonode.cloud" if network == "mainnet" else "https://testnet-api.algonode.cloud"
    algod_address = os.getenv("ALGOD_ADDRESS", default_algod)
    algod_token = os.getenv("ALGOD_TOKEN", "")
    deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC_VAR")

    default_app = "3650633378" if network == "mainnet" else "767583704"
    app_id = int(os.getenv("ESCROW_APP_ID", default_app))

    if not deployer_mnemonic or app_id == 0:
        print("ERROR: DEPLOYER_MNEMONIC_VAR and ESCROW_APP_ID must be configured.")
        return

    client = algod.AlgodClient(algod_token, algod_address)
    private_key = mnemonic.to_private_key(deployer_mnemonic)
    sender_address = account.address_from_private_key(private_key)

    print(f"Contract Owner: {sender_address}")
    print(f"Updating Escrow App ID {app_id} pricing on-chain:")
    print(f" - Base Price: {new_base_microusdc:,} microUSDC (${new_base_microusdc / 1e6:.4f} USD)")
    print(f" - Byte Price: {new_byte_price:,} microUSDC/byte")

    # ABI method signature: update_pricing(uint64,uint64)void
    update_method = abi.Method.from_signature("update_pricing(uint64,uint64)void")
    signer = AccountTransactionSigner(private_key)

    params = client.suggested_params()

    atc = AtomicTransactionComposer()
    atc.add_method_call(
        app_id=app_id,
        method=update_method,
        sender=sender_address,
        sp=params,
        signer=signer,
        method_args=[new_base_microusdc, new_byte_price],
    )

    try:
        result = atc.execute(client, 4)
        print(f"Pricing updated on-chain! Tx ID: {result.tx_ids[0]}")
    except Exception as e:
        print(f"ERROR updating pricing: {e}")

if __name__ == "__main__":
    new_base = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
    new_byte = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    update_pricing(new_base, new_byte)
