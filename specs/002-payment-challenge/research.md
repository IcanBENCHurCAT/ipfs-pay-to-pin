# Research: AB-PP-002 (x402 Dynamic Payment Challenge & Local Verification)

This document records the research and decisions regarding Algorand transaction verification, querying smart contract global state, and temporary file storage mechanics.

## 1. Querying Smart Contract Global State

### Decision
Use the Algod client (`algosdk.v2client.algod.AlgodClient`) to fetch the application info and decode its global state keys and values.

### Rationale
- The contract is compiled and deployed (or mocked for testing).
- Global state on-chain is stored in the application state. We can query this dynamically via `algod_client.application_info(app_id)`.
- The keys in global state (e.g., `base_price` and `byte_price`) are stored as binary (bytes), which are returned in base64 format via the API.
- We need to decode the base64 keys and retrieve their corresponding `uint` values.

### Alternatives Considered
- **Config-only fallback**: Hardcoding base/byte prices in `.env`.
  - *Rejected because*: Violates **FR-001** and the Constitution which require querying the contract pricing.
- **Client Cache**: Caching retrieved rates for a short TTL (e.g., 5 minutes) to avoid rate limits on the Algod client.
  - *Chosen*: We will use a simple in-memory caching mechanism with a TTL.

---

## 2. On-Chain Transaction Verification

### Decision
Verify the payment transaction using the Algod client or Indexer client. We fetch the transaction details using `algod_client.pending_transaction_info(tx_id)` (for recently committed txns) or via the Indexer client `indexer_client.search_transactions(txid=tx_id)`.

### Verification Steps
To prevent exploits, the verification MUST validate the following:
1. **Transaction Type**: Must be a payment (`pay`) transaction.
2. **Receiver**: Must match the escrow address of the gateway.
3. **Amount**: Must be greater than or equal to the challenge's computed fee (in microALGOs).
4. **Sender**: Optional validation, but the system must ensure the note matches the challenge.
5. **Note Field**: Must contain the exact challenge `reference_id` (decoded from bytes).
6. **Confirmed Round**: The transaction must be confirmed (`confirmed-round` > 0).

### Reference ID & Note Format
Algorand transaction note fields are arbitrary bytes. The client will encode the reference ID (UUIDv4 string) as UTF-8 bytes and put it in the transaction note.
The backend will decode the note field:
```python
import base64

# Algod API returns note field as a base64-encoded string
raw_note = txn_info.get("txn", {}).get("txn", {}).get("note", b"")
if isinstance(raw_note, str):
    decoded_note = base64.b64decode(raw_note).decode("utf-8")
else:
    decoded_note = raw_note.decode("utf-8")
```

---

## 3. Double-Spend Prevention

### Decision
Maintain a persistent/shared registry of already-verified transaction IDs.
- For local development and testing, an in-memory `set` (or dictionary) of processed `tx_id`s will be used.
- In production, this should be backed by a persistent database (e.g., SQLite or Redis) with unique constraints on `tx_id`.

---

## 4. Temporary File Cache

### Decision
Store the uploaded file contents in memory (using a dictionary keyed by `reference_id`) during the challenge phase.
- Since files are held only until verification (usually a few blocks, ~3.3 seconds), an in-memory cache is sufficient for the mock/test version.
- A TTL-based clean-up task (or background scheduler) should evict expired/unpaid challenges to prevent memory exhaustion.
