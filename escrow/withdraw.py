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

def withdraw(amount: float, asset_type: str = "usdc", target_receiver: str = None):
    network = os.getenv("ALGORAND_NETWORK", "mainnet").lower()
    default_algod = "https://mainnet-api.algonode.cloud" if network == "mainnet" else "https://testnet-api.algonode.cloud"
    algod_address = os.getenv("ALGOD_ADDRESS", default_algod)
    algod_token = os.getenv("ALGOD_TOKEN", "")
    deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC_VAR")

    default_app = "3650633378" if network == "mainnet" else "767583704"
    app_id = int(os.getenv("ESCROW_APP_ID", default_app))
    usdc_id = int(os.getenv("USDC_ASSET_ID", "31566704" if network == "mainnet" else "10458941"))

    if not deployer_mnemonic or app_id == 0:
        print("ERROR: DEPLOYER_MNEMONIC_VAR and ESCROW_APP_ID must be configured.")
        return

    client = algod.AlgodClient(algod_token, algod_address)
    private_key = mnemonic.to_private_key(deployer_mnemonic)
    sender_address = account.address_from_private_key(private_key)

    if not target_receiver:
        target_receiver = sender_address

    signer = AccountTransactionSigner(private_key)
    params = client.suggested_params()
    params.fee = 2000
    params.flat_fee = True

    atc = AtomicTransactionComposer()

    if asset_type.lower() in ("usdc", "asa"):
        amount_micro = int(amount * 1_000_000)
        print(f"Owner Account: {sender_address}")
        print(f"Withdrawing ${amount:.4f} USDC ({amount_micro:,} microUSDC) from App ID {app_id} to {target_receiver}...")

        # ABI method signature: withdraw_assets(uint64,uint64,address)void
        withdraw_method = abi.Method.from_signature("withdraw_assets(uint64,uint64,address)void")
        atc.add_method_call(
            app_id=app_id,
            method=withdraw_method,
            sender=sender_address,
            sp=params,
            signer=signer,
            method_args=[usdc_id, amount_micro, target_receiver],
            foreign_assets=[usdc_id],
        )
    else:
        amount_micro = int(amount * 1_000_000)
        print(f"Owner Account: {sender_address}")
        print(f"Withdrawing {amount:.6f} ALGO ({amount_micro:,} microALGOs) from App ID {app_id} to {target_receiver}...")

        # ABI method signature: withdraw_fees(uint64,account)void
        withdraw_method = abi.Method.from_signature("withdraw_fees(uint64,account)void")
        atc.add_method_call(
            app_id=app_id,
            method=withdraw_method,
            sender=sender_address,
            sp=params,
            signer=signer,
            method_args=[amount_micro, target_receiver],
        )

    try:
        result = atc.execute(client, 4)
        print(f"Withdrawal transaction confirmed! Tx ID: {result.tx_ids[0]}")
        print(f"Successfully transferred {amount} {asset_type.upper()} to {target_receiver}!")
    except Exception as e:
        print(f"ERROR withdrawing funds: {e}")

if __name__ == "__main__":
    amt = float(sys.argv[1]) if len(sys.argv) > 1 else 0.001
    asset = sys.argv[2] if len(sys.argv) > 2 else "usdc"
    withdraw(amt, asset)
