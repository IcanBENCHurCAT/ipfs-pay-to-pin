# Quickstart Validation Guide

This guide describes how to validate the `ipfs-pay-to-pin-client` end-to-end.

## Prerequisites
- Python 3.9+ installed.
- An Algorand testnet account with microUSDC and ALGO for transaction fees.
- The `ipfs-pay-to-pin` backend running locally or on testnet.

## 1. Installation
```bash
pip install ipfs-pay-to-pin-client
```

## 2. Pinning a File
Create a file `test.txt` and run this Python script:

```python
from ipfs_pay_to_pin_client import IpfsPayToPinClient

client = IpfsPayToPinClient(
    mnemonic="your 25 word mnemonic here...",
    gateway_url="http://localhost:4021",
    network="testnet",
    max_price_usdc=1.0 # Will not pay more than 1 USDC
)

try:
    response = client.pin_file("test.txt")
    print(f"Pinned successfully! IPFS CID: {response.ipfs_cid}")
    print(f"Expires at: {response.expires_at}")
except Exception as e:
    print(f"Failed to pin: {e}")
```

## 3. Expected Outcome
The script should output the newly pinned CID and expiration timestamp.
If the requested price exceeds 1.0 USDC, an `InsufficientBudgetError` should be raised.
