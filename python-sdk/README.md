# IPFS Pay-to-Pin Python SDK (`ipfs-pay-to-pin-client`)

Python client library for pinning files to IPFS via the standard 402 Payment Required microUSDC gateway on Algorand.

## Installation

```bash
pip install ipfs-pay-to-pin-client
```

## Usage

```python
from ipfs_pay_to_pin_client import IpfsPayToPinClient

# Initialize client with Gateway URL and Algorand 25-word mnemonic
client = IpfsPayToPinClient(
    gateway_url="https://your-pay-to-pin-gateway.com",
    sender_mnemonic="your twenty five word algorand account mnemonic phrase goes here..."
)

# Pin a file with optional max price safety limit (in USDC)
response = client.pin_file("path/to/my-file.pdf", max_price_usdc=1.0)
print(f"Pinned CID: {response.cid}")
print(f"Pin Expires At: {response.pin_expires_at}")

# Pin raw bytes directly
raw_data = b"Hello, decentralized storage!"
response = client.pin_bytes(raw_data, filename="hello.txt")

# Check status of an existing CID
status = client.get_status(response.cid)
print(status)
```

## Features

- Automatic x402 402 Payment Required challenge handler
- Algorand microUSDC settlement
- Account rekey detection for security
- Maximum price ceiling enforcement (`max_price_usdc`)
