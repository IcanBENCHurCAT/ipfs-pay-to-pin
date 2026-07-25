import os
from algosdk.v2client import algod
from algosdk import mnemonic, account, abi
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)
from dotenv import load_dotenv

load_dotenv()

def opt_in_usdc():
    algod_address = os.getenv("ALGOD_ADDRESS", "https://mainnet-api.algonode.cloud")
    algod_token = os.getenv("ALGOD_TOKEN", "")
    deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC_VAR")
    app_id = int(os.getenv("ESCROW_APP_ID", "0"))

    network = os.getenv("ALGORAND_NETWORK", "mainnet").lower()
    usdc_asset_id = int(os.getenv("USDC_ASSET_ID", "31566704" if network == "mainnet" else "10458941"))

    if not deployer_mnemonic or app_id == 0:
        print("ERROR: DEPLOYER_MNEMONIC_VAR and ESCROW_APP_ID must be configured in .env")
        return

    client = algod.AlgodClient(algod_token, algod_address)
    private_key = mnemonic.to_private_key(deployer_mnemonic)
    sender_address = account.address_from_private_key(private_key)

    print(f"Owner Wallet: {sender_address}")
    print(f"Opting Escrow App ID {app_id} into USDC ASA ID {usdc_asset_id}...")

    # ABI method signature: opt_in_asset(asset)void
    opt_in_method = abi.Method.from_signature("opt_in_asset(asset)void")
    signer = AccountTransactionSigner(private_key)

    params = client.suggested_params()
    # Outer transaction covers inner transaction fee (min fee 1000 + inner 1000 = 2000 microALGOs)
    params.fee = 2000
    params.flat_fee = True

    atc = AtomicTransactionComposer()
    atc.add_method_call(
        app_id=app_id,
        method=opt_in_method,
        sender=sender_address,
        sp=params,
        signer=signer,
        method_args=[usdc_asset_id],
    )

    try:
        result = atc.execute(client, 4)
        print(f"Opt-in transaction confirmed! Tx ID: {result.tx_ids[0]}")
        print(f"Successfully opted Escrow App ID {app_id} into USDC ASA ID {usdc_asset_id}!")
    except Exception as e:
        print(f"ERROR opting in to USDC: {e}")

if __name__ == "__main__":
    opt_in_usdc()
