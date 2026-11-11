# IPFS Pay-to-Pin Python SDK (`ipfs-pay-to-pin-client`)

Python client library for pinning files to IPFS via standard HTTP 402 Payment Required microUSDC micropayments across **Base L2, Arbitrum One, Solana, Algorand, and Ethereum L1**.

- **Live Gateway API**: `https://pay-to-pin.duckdns.org`
- **Protocol Standard**: HTTP `402 Payment Required` via x402 specification

---

## Installation

```bash
# Basic install
pip install ipfs-pay-to-pin-client

# Install with EVM support (Base L2 and Arbitrum One gasless EIP-3009, Ethereum L1)
pip install "ipfs-pay-to-pin-client[evm]"

# Install with all multi-chain signers
pip install "ipfs-pay-to-pin-client[all]"
```

---

## Quickstart & Usage

### 1. Multi-Chain Initialization Options

```python
from ipfs_pay_to_pin_client import IpfsPayToPinClient

# Option A: EVM Private Key (Base L2 and Arbitrum One gasless EIP-3009 transfer, Ethereum L1)
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
```

### 2. Pinning Files & Bytes

```python
# Pin a file on disk with optional max price safety limit (in USDC)
response = client.pin_file("path/to/my-file.pdf", max_price_usdc=1.0)
print(f"Pinned CID: {response.cid}")
print(f"Status: {response.status}")
print(f"Expires At: {response.pin_expires_at}")

# Pin raw bytes directly
raw_data = b"Hello, decentralized storage!"
response = client.pin_bytes(raw_data, filename="hello.txt")
```

### 3. Renew an Existing Pin (50% Early Renewal Discount)

Autonomous agents can extend retention for another 365 days by calling `renew_pin`:

```python
# Renew retention for an existing CID
renewal = client.renew_pin("bafkreiewws62ozsuqdylwhlj2ylu7hxauxygofmiuiezncvmjg2gofg2hq", max_price_usdc=0.5)
print(f"Renewed CID: {renewal.cid}")
print(f"New Expiration Date: {renewal.pin_expires_at}")
```

### 4. Check Retention Status (Free)

```python
# Public status lookup (no payment required) via get_pin_status (or get_status)
status = client.get_pin_status("bafkreiewws62ozsuqdylwhlj2ylu7hxauxygofmiuiezncvmjg2gofg2hq")
print(f"Days Remaining: {status.get('days_remaining')}")
print(f"Is Active: {status.get('is_active')}")
```

---

## Dynamic Pricing & Retention Rules

- **Base Upload Fee**: `0.01 USDC` (10,000 microUSDC) + `0.000001 USDC/byte`.
- **Retention Timebox**: `365 days` per payment.
- **Early Renewal Discount**: `50% off` standard price when renewed prior to expiration date.
- **Grace Period**: `30 days` after expiration before files are unpinned.

---

## Error Handling

The SDK defines specialized exception classes in `ipfs_pay_to_pin_client.exceptions` to allow autonomous agents and applications to handle payment and gateway edge cases cleanly:

- `PinNotFoundError`: Inherits from `PinningFailedError` (status code 404). Raised when a requested IPFS CID is not found or has expired during `get_status` (`get_pin_status`) or `renew_pin`. Allows autonomous agents to detect missing resources programmatically.
- `ExceedsMaxPriceError`: Raised when the payment requested by the gateway exceeds your specified `max_price_usdc` ceiling.
- `PaymentRequiredError`: Raised when an HTTP 402 challenge occurs without valid header data or no wallet is configured for the required network.
- `PinningFailedError`: Raised when the gateway returns an error (e.g. 500, 503 Service Unavailable, or 400 Bad Request) or when settlement fails.
- `InsufficientFundsError`: Raised when the target wallet lacks sufficient balance for the microUSDC payment or network fees.
- `RekeyDetectedError`: Raised if an Algorand account spending key has been rekeyed unexpectedly.
- `PayToPinError`: Base exception for all SDK errors.

Example:
```python
from ipfs_pay_to_pin_client import IpfsPayToPinClient
from ipfs_pay_to_pin_client.exceptions import (
    ExceedsMaxPriceError,
    PaymentRequiredError,
    PinNotFoundError,
    PinningFailedError,
    PayToPinError,
)

try:
    response = client.pin_file("large-data.json", max_price_usdc=0.50)
except ExceedsMaxPriceError as e:
    print(f"Price ceiling exceeded: {e}")
except PaymentRequiredError as e:
    print(f"Payment challenge error: {e}")
except PinNotFoundError as e:
    print(f"CID not found or expired (404): {e}")
except PinningFailedError as e:
    print(f"Gateway or pinning failed: {e}")
except PayToPinError as e:
    print(f"General SDK error: {e}")
```

---

## Features

- Automatic multi-chain x402 402 Payment Required challenge handler
- Native support for Base L2 and Arbitrum One (EIP-3009 gasless permits), Solana Mainnet, Algorand Mainnet, and Ethereum L1
- Annual pin renewal extensions with `renew_pin` (50% early renewal discount)
- Automated network steering prioritizing zero-gas / lowest-fee options
- Maximum price ceiling enforcement (`max_price_usdc`)

---

## Development & Testing

To set up the Python SDK locally for development, install development dependencies and run the lint and test suite matching the CI workflow:

```bash
# Navigate to the python-sdk directory
cd python-sdk

# Install in editable mode with development and optional CLI dependencies
pip install -e ".[dev]"

# Run ruff lint checks
ruff check .

# Run SDK and CLI unit tests with top-level package resolution
PYTHONPATH=.. python3 -m pytest tests/ ../tests/
```

---

## License

MIT License. See [LICENSE](../LICENSE) for full text.
