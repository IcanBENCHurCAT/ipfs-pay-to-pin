import os
from algosdk import mnemonic, account, transaction
from algosdk.v2client import algod

MAINNET_ALGOD = "https://mainnet-api.algonode.cloud"
MNEMONIC_STR = "REDACTED"
USDC_ID = 31566704

def main():
    private_key = mnemonic.to_private_key(MNEMONIC_STR)
    wallet_address = account.address_from_private_key(private_key)

    client = algod.AlgodClient("", MAINNET_ALGOD)

    print(f"Opting wallet {wallet_address} into USDC ASA ID {USDC_ID} on Mainnet...")

    params = client.suggested_params()
    txn = transaction.AssetTransferTxn(
        sender=wallet_address,
        sp=params,
        receiver=wallet_address,
        amt=0,
        index=USDC_ID
    )

    signed_txn = txn.sign(private_key)
    tx_id = signed_txn.get_txid()
    print(f"Submitting Opt-in Txn... ID: {tx_id}")

    client.send_transaction(signed_txn)
    confirmed = transaction.wait_for_confirmation(client, tx_id, 4)
    print(f"Opt-in confirmed in round {confirmed['confirmed-round']}!")

if __name__ == "__main__":
    main()
