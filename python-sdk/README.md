# IPFS Pay-to-Pin Python SDK (`ipfs-pay-to-pin-client`)

Python client library for pinning files to IPFS via standard HTTP 402 Payment Required microUSDC micropayments across **Base L2, Solana, and Algorand**.

## Installation

```bash
# Basic install
pip install ipfs-pay-to-pin-client

# Install with EVM support (Base L2 gasless EIP-3009)
pip install "ipfs-pay-to-pin-client[evm]"

# Install with all multi-chain signers
pip install "ipfs-pay-to-pin-client[all]"
```

## Usage

```python
from ipfs_pay_to_pin_client import IpfsPayToPinClient

# Option A: Base L2 / EVM Private Key (Gasless EIP-3009 transfer)
client = IpfsPayToPinClient(
    gateway_url="https://pay-to-pin.duckdns.org",
    evm_private_key="0xYourBaseEvmPrivateKey..."
)

# Option B: Solana Wallet
client = IpfsPayToPinClient(
    gateway_url="https://pay-to-pin.duckdns.org",
    solana_private_key="YourSolanaBase58PrivateKey..."
)

# Option C: Algorand Wallet
client = IpfsPayToPinClient(
    gateway_url="https://pay-to-pin.duckdns.org",
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

- Automatic multi-chain x402 402 Payment Required challenge handler
- Native support for Base L2 (EIP-3009), Solana Mainnet, and Algorand Mainnet
- Automated network steering prioritizing zero-gas / lowest-fee options
- Maximum price ceiling enforcement (`max_price_usdc`)

