import os
from algosdk.v2client import algod
from algosdk import mnemonic, account, abi
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)

MAINNET_ALGOD = "https://mainnet-api.algonode.cloud"
USDC_MAINNET_ID = 31566704
APP_ID = 3650633378
MNEMONIC_STR = os.getenv("DEPLOYER_MNEMONIC", "REDACTED")

def opt_in():
    client = algod.AlgodClient("", MAINNET_ALGOD)
    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    sender_address = account.address_from_private_key(private_key)

    print(f"Opting Escrow App ID {APP_ID} into USDC ASA ID {USDC_MAINNET_ID} on Mainnet...")

    opt_in_method = abi.Method.from_signature("opt_in_asset(uint64)void")
    signer = AccountTransactionSigner(private_key)

    params = client.suggested_params()
    params.fee = 2000
    params.flat_fee = True

    atc = AtomicTransactionComposer()
    atc.add_method_call(
        app_id=APP_ID,
        method=opt_in_method,
        sender=sender_address,
        sp=params,
        signer=signer,
        method_args=[USDC_MAINNET_ID],
        foreign_assets=[USDC_MAINNET_ID],
    )

    res = atc.execute(client, 4)
    print(f"Escrow Contract Opted into USDC! Tx ID: {res.tx_ids[0]}")

if __name__ == "__main__":
    opt_in()
