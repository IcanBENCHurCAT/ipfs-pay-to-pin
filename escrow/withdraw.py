import os
import sys
from algosdk.v2client import algod
from algosdk import mnemonic, account, abi, logic
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)
from dotenv import load_dotenv

load_dotenv()

def withdraw(amount_arg: str = "all", asset_type: str = "usdc", target_receiver: str = None):
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

    escrow_address = logic.get_application_address(app_id)

    escrow_acct = client.account_info(escrow_address)
    usdc_balance = 0
    for a in escrow_acct.get("assets", []):
        if a.get("asset-id") == usdc_id or a.get("assetId") == usdc_id:
            usdc_balance = int(a.get("amount", 0))

    algo_balance = int(escrow_acct.get("amount", 0))

    if asset_type.lower() in ("usdc", "asa"):
        if amount_arg.lower() in ("all", "max"):
            amount_micro = usdc_balance
        else:
            amount_micro = int(float(amount_arg) * 1_000_000)

        if amount_micro == 0:
            print(f"No USDC balance available to withdraw. Current Escrow Balance: 0 microUSDC")
            return

        if amount_micro > usdc_balance:
            print(f"ERROR: Requested withdrawal of ${amount_micro / 1_000_000:.6f} USDC ({amount_micro:,} microUSDC) exceeds current Escrow USDC Balance of ${usdc_balance / 1_000_000:.6f} USDC ({usdc_balance:,} microUSDC).")
            print(f"Tip: Run 'python escrow/withdraw.py all' to automatically withdraw 100% of available funds (${usdc_balance / 1_000_000:.6f} USDC).")
            return

        print(f"Owner Account:   {sender_address}")
        print(f"Escrow Address:  {escrow_address}")
        print(f"Withdrawing:     ${amount_micro / 1_000_000:.6f} USDC ({amount_micro:,} microUSDC) from App ID {app_id} to {target_receiver}...")

        signer = AccountTransactionSigner(private_key)
        params = client.suggested_params()
        params.fee = 2000
        params.flat_fee = True

        atc = AtomicTransactionComposer()
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

        try:
            result = atc.execute(client, 4)
            print(f"SUCCESS: Withdrawal confirmed! Tx ID: {result.tx_ids[0]}")
            print(f"Successfully transferred ${amount_micro / 1_000_000:.6f} USDC to {target_receiver}!")
        except Exception as e:
            print(f"ERROR withdrawing funds: {e}")

    else: # ALGO withdrawal
        min_balance = 200_000 # Minimum balance requirement for contract escrow
        withdrawable_algo = max(0, algo_balance - min_balance)

        if amount_arg.lower() in ("all", "max"):
            amount_micro = withdrawable_algo
        else:
            amount_micro = int(float(amount_arg) * 1_000_000)

        if amount_micro > withdrawable_algo:
            print(f"ERROR: Requested ALGO withdrawal ({amount_micro:,} microALGO) exceeds withdrawable balance ({withdrawable_algo:,} microALGO).")
            return

        print(f"Owner Account:   {sender_address}")
        print(f"Withdrawing:     {amount_micro / 1_000_000:.6f} ALGO ({amount_micro:,} microALGOs) from App ID {app_id} to {target_receiver}...")

        signer = AccountTransactionSigner(private_key)
        params = client.suggested_params()
        params.fee = 2000
        params.flat_fee = True

        atc = AtomicTransactionComposer()
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
            print(f"SUCCESS: ALGO Withdrawal confirmed! Tx ID: {result.tx_ids[0]}")
            print(f"Successfully transferred {amount_micro / 1_000_000:.6f} ALGO to {target_receiver}!")
        except Exception as e:
            print(f"ERROR withdrawing ALGO: {e}")

if __name__ == "__main__":
    amt_input = sys.argv[1] if len(sys.argv) > 1 else "all"
    asset_input = sys.argv[2] if len(sys.argv) > 2 else "usdc"
    withdraw(amt_input, asset_input)
