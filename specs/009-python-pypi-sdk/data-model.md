# Data Model

## Entities

### `IpfsPayToPinClient`
The primary SDK class.

**Fields (Initialization):**
- `mnemonic` (str): 25-word Algorand mnemonic.
- `sender` (Optional[str]): Address of the sender, if rekeying is used.
- `gateway_url` (str): URL of the Pay-to-Pin API.
- `network` (str): 'mainnet' or 'testnet'.
- `max_price_usdc` (float): Maximum acceptable price to pay for pinning.
- `confirm_price` (Optional[Callable[[float], bool]]): Callback to confirm price before signing.

**Methods:**
- `pin_file(file_path: str) -> PinResponse`
- `pin_bytes(data: bytes, filename: Optional[str] = None) -> PinResponse`
- `get_status(cid: str) -> dict`
- `renew_pin(cid: str, duration_days: int) -> dict`

### `PinResponse` (Dataclass)
Represents a successful pin response.

**Fields:**
- `status` (str): Status of the pin (e.g., 'queued', 'pinned')
- `cid` (str): Internal/Database ID
- `ipfs_cid` (str): The actual IPFS CIDv1
- `gateway_url` (str): Resolvable URL to the file
- `pinned_at` (str): ISO-8601 timestamp
- `expires_at` (str): ISO-8601 timestamp
- `ttl_days` (int): Number of days until expiration
- `renewal_url` (str): Endpoint to hit for renewal

## Exceptions
- `x402ProtocolError`: Base exception for protocol errors.
- `InsufficientBudgetError`: Raised when the `PAYMENT-REQUIRED` price exceeds `max_price_usdc` or wallet lacks funds.
- `PaymentDeclinedError`: Raised if `confirm_price` callback returns False.
- `GatewayError`: Raised on HTTP 5xx or unhandled 4xx (except 402).
