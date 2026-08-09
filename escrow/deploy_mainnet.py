import os
import base64
from algosdk.v2client import algod
from algosdk import mnemonic, account, transaction, abi
from algosdk.logic import get_application_address
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)
from dotenv import load_dotenv

load_dotenv()

MAINNET_ALGOD = "https://mainnet-api.algonode.cloud"
USDC_MAINNET_ID = 31566704
MNEMONIC_STR = os.getenv("DEPLOYER_MNEMONIC")

if not MNEMONIC_STR:
    print("ERROR: DEPLOYER_MNEMONIC is not set in the environment or .env file.")
    exit(1)

def deploy_mainnet():
    client = algod.AlgodClient("", MAINNET_ALGOD)

    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    sender_address = account.address_from_private_key(private_key)

    print(f"Deploying PayToPinEscrow Smart Contract to ALGORAND MAINNET...")
    print(f"Deployer / Owner Account: {sender_address}")

    # Check deployer ALGO balance
    acc_info = client.account_info(sender_address)
    print(f"Deployer Balance: {acc_info['amount'] / 1e6:.6f} ALGO")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    approval_path = os.path.join(base_dir, "PayToPinEscrow.approval.teal")
    clear_path = os.path.join(base_dir, "PayToPinEscrow.clear.teal")

    with open(approval_path, "r") as f:
        approval_source = f.read()
    with open(clear_path, "r") as f:
        clear_source = f.read()

    print("Compiling TEAL programs on Mainnet node...")
    approval_bytes = base64.b64decode(client.compile(approval_source)["result"])
    clear_bytes = base64.b64decode(client.compile(clear_source)["result"])

    params = client.suggested_params()
    global_schema = transaction.StateSchema(num_uints=2, num_byte_slices=1)
    local_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)
    create_selector = bytes.fromhex("4c5c61ba")  # create()void

    txn = transaction.ApplicationCreateTxn(
        sender=sender_address,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_bytes,
        clear_program=clear_bytes,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=[create_selector],
    )

    signed_txn = txn.sign(private_key)
    tx_id = client.send_transaction(signed_txn)
    print(f"Application Create Txn Submitted! ID: {tx_id}")
    confirmed = transaction.wait_for_confirmation(client, tx_id, 4)

    app_id = confirmed["application-index"]
    escrow_address = get_application_address(app_id)

    print(f"\n==========================================")
    print(f"MAINNET CONTRACT DEPLOYED SUCCESSFULLY!")
    print(f"Application ID: {app_id}")
    print(f"Escrow Address: {escrow_address}")
    print(f"==========================================\n")

    # Seed Escrow Account MBR (0.2 ALGO)
    print("Seeding Escrow Account with 0.2 ALGO MBR...")
    seed_txn = transaction.PaymentTxn(
        sender=sender_address,
        sp=params,
        receiver=escrow_address,
        amt=200000
    )
    seed_id = client.send_transaction(seed_txn.sign(private_key))
    transaction.wait_for_confirmation(client, seed_id, 4)
    print("Escrow Account seeded with 0.2 ALGO!")

    # Opt Escrow Contract into USDC (ASA ID 31566704)
    print(f"Opting Escrow Contract ({escrow_address}) into USDC ASA ID {USDC_MAINNET_ID}...")
    opt_in_method = abi.Method.from_signature("opt_in_asset(asset)void")
    signer = AccountTransactionSigner(private_key)

    opt_params = client.suggested_params()
    opt_params.fee = 2000
    opt_params.flat_fee = True

    atc = AtomicTransactionComposer()
    atc.add_method_call(
        app_id=app_id,
        method=opt_in_method,
        sender=sender_address,
        sp=opt_params,
        signer=signer,
        method_args=[USDC_MAINNET_ID],
    )
    opt_res = atc.execute(client, 4)
    print(f"Escrow Contract Opted into USDC! Tx ID: {opt_res.tx_ids[0]}")

    print("\n" + "="*60)
    print("MAINNET SMART CONTRACT SETUP COMPLETE!")
    print("="*60)
    print(f"ESCROW_APP_ID={app_id}")
    print(f"ESCROW_ADDRESS={escrow_address}")
    print(f"USDC_ASSET_ID={USDC_MAINNET_ID}")
    print(f"PAYMENT_CURRENCY=USDC")
    print(f"ALGORAND_NETWORK=mainnet")
    print("="*60)

if __name__ == "__main__":
    deploy_mainnet()
