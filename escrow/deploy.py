import os
import base64
from algosdk.v2client import algod
from algosdk import mnemonic, transaction
from algosdk.logic import get_application_address
from dotenv import load_dotenv

load_dotenv()

def deploy():
    # 1. Load configuration
    algod_address = os.getenv("ALGOD_ADDRESS", "https://testnet-api.algonode.cloud")
    algod_token = os.getenv("ALGOD_TOKEN", "")
    deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC")

    if not deployer_mnemonic:
        print("ERROR: DEPLOYER_MNEMONIC is not set in the environment or .env file.")
        print("Please set DEPLOYER_MNEMONIC to deploy the smart contract.")
        return

    # Initialize client
    client = algod.AlgodClient(algod_token, algod_address)

    # Load account
    try:
        private_key = mnemonic.to_private_key(deployer_mnemonic)
        sender_address = mnemonic.to_public_key(deployer_mnemonic)
    except Exception as e:
        print(f"ERROR loading deployer mnemonic: {e}")
        return

    print(f"Deployer account: {sender_address}")

    # 2. Read compiled TEAL source code
    base_dir = os.path.dirname(os.path.abspath(__file__))
    approval_path = os.path.join(base_dir, "PayToPinEscrow.approval.teal")
    clear_path = os.path.join(base_dir, "PayToPinEscrow.clear.teal")

    if not os.path.exists(approval_path) or not os.path.exists(clear_path):
        print("ERROR: Compiled TEAL files not found in the escrow directory.")
        print("Make sure PayToPinEscrow.approval.teal and PayToPinEscrow.clear.teal exist.")
        return

    with open(approval_path, "r") as f:
        approval_source = f.read()

    with open(clear_path, "r") as f:
        clear_source = f.read()

    # 3. Compile TEAL code
    print("Compiling TEAL programs on-chain...")
    try:
        approval_compiled = client.compile(approval_source)
        approval_bytes = base64.b64decode(approval_compiled["result"])

        clear_compiled = client.compile(clear_source)
        clear_bytes = base64.b64decode(clear_compiled["result"])
    except Exception as e:
        print(f"ERROR compiling contract: {e}")
        return

    # 4. Create App transaction
    print("Building application creation transaction...")
    params = client.suggested_params()
    
    # State allocation schema
    # The contract PayToPinEscrow has 3 global variables: owner (Account), base_price (uint64), byte_price (uint64)
    # Global state schema: 1 byte-slices (for owner), 2 integers (for prices)
    # Local state schema: 0 byte-slices, 0 integers
    global_schema = transaction.StateSchema(num_uints=2, num_byte_slices=1)
    local_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)

    # PayToPinEscrow.create() is an ARC-4 abi method with no arguments
    # ABI method signature: create()void
    # We can create it using a standard ApplicationCreateTxn
    txn = transaction.ApplicationCreateTxn(
        sender=sender_address,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_bytes,
        clear_program=clear_bytes,
        global_schema=global_schema,
        local_schema=local_schema,
    )

    # Sign transaction
    signed_txn = txn.sign(private_key)

    # Send transaction
    print("Submitting transaction to the network...")
    try:
        tx_id = client.send_transaction(signed_txn)
        print(f"Transaction submitted successfully! ID: {tx_id}")
        
        # Wait for confirmation
        print("Waiting for confirmation...")
        confirmed_txn = transaction.wait_for_confirmation(client, tx_id, 4)
        app_id = confirmed_txn["application-index"]
        escrow_address = get_application_address(app_id)
        
        print("\n" + "="*50)
        print("Smart Contract Deployed Successfully!")
        print("="*50)
        print(f"Application ID:   {app_id}")
        print(f"Escrow Address:   {escrow_address}")
        print("="*50)
        print("\nUse the values above to set your Heroku Config Vars:")
        print(f"ESCROW_APP_ID={app_id}")
        print(f"ESCROW_ADDRESS={escrow_address}")
        print("="*50)

    except Exception as e:
        print(f"ERROR submitting transaction: {e}")

if __name__ == "__main__":
    deploy()
