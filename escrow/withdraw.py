import os
from algosdk.v2client import algod
from algosdk import mnemonic, account, transaction, abi
from dotenv import load_dotenv

load_dotenv()

def withdraw(amount_algo: float, target_receiver: str = None):
    algod_address = os.getenv("ALGOD_ADDRESS", "https://testnet-api.algonode.cloud")
    algod_token = os.getenv("ALGOD_TOKEN", "")
    deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC_VAR")
    app_id = int(os.getenv("ESCROW_APP_ID", "0"))

    if not deployer_mnemonic or app_id == 0:
        print("ERROR: DEPLOYER_MNEMONIC_VAR and ESCROW_APP_ID must be configured in .env")
        return

    client = algod.AlgodClient(algod_token, algod_address)
    private_key = mnemonic.to_private_key(deployer_mnemonic)
    sender_address = account.address_from_private_key(private_key)

    if not target_receiver:
        target_receiver = sender_address

    amount_microalgos = int(amount_algo * 1_000_000)

    print(f"Owner Account: {sender_address}")
    print(f"Withdrawing {amount_algo} ALGO ({amount_microalgos} microALGOs) to {target_receiver} from App ID {app_id}...")

    # ABI method signature: withdraw_fees(uint64,account)void
    # Selector: bytes.fromhex sha256("withdraw_fees(uint64,account)void")[:4]
    # abi Method interface
    withdraw_method = abi.Method.from_signature("withdraw_fees(uint64,account)void")

    params = client.suggested_params()
    # Contract inner transaction needs to pay min fee (1000 microALGOs), so we cover fee = 2000 microALGOs
    params.fee = 2000
    params.flat_fee = True

    # Encode arguments for withdraw_fees(amount, receiver_index)
    # In ARC-4, account arguments are passed in app_accounts and referenced by 1-based index
    app_args = [
        withdraw_method.get_selector(),
        amount_microalgos.to_bytes(8, "big"),
        bytes([1]) # 1-based index into app_accounts
    ]

    txn = transaction.ApplicationNoOpTxn(
        sender=sender_address,
        sp=params,
        index=app_id,
        app_args=app_args,
        accounts=[target_receiver]
    )

    signed_txn = txn.sign(private_key)

    try:
        tx_id = client.send_transaction(signed_txn)
        print(f"Withdrawal transaction submitted! ID: {tx_id}")
        confirmed = transaction.wait_for_confirmation(client, tx_id, 4)
        print("Withdrawal Confirmed in round:", confirmed["confirmed-round"])
        print(f"Successfully transferred {amount_algo} ALGO to {target_receiver}!")
    except Exception as e:
        print(f"ERROR withdrawing funds: {e}")

if __name__ == "__main__":
    import sys
    amount = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
    withdraw(amount)
