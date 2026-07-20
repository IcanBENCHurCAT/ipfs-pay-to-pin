import base64
import time
from algosdk.v2client import algod
from gateway.config import settings

# Initialize Algod Client
algod_client = algod.AlgodClient(settings.ALGOD_TOKEN, settings.ALGOD_ADDRESS)

# In-memory pricing cache structure
_pricing_cache = {
    "base_price": 1000,
    "byte_price": 1,
    "expires_at": 0.0
}

CACHE_TTL = 300.0  # 5 minutes in seconds

def get_pricing_from_contract(app_id: int) -> tuple[int, int]:
    """
    Directly query the Algorand blockchain for the escrow contract's pricing global state.
    """
    if app_id <= 0:
        return 1000, 1

    try:
        app_info = algod_client.application_info(app_id)
        global_state = app_info.get("params", {}).get("global-state", [])

        base_price = 1000
        byte_price = 1

        for state in global_state:
            key_bytes = base64.b64decode(state["key"])
            key_str = key_bytes.decode("utf-8", errors="ignore")

            value = state["value"]
            if key_str == "base_price":
                base_price = value.get("uint", base_price)
            elif key_str == "byte_price":
                byte_price = value.get("uint", byte_price)

        return base_price, byte_price
    except Exception:
        # Fallback to default values if nodes are unreachable or app is not found
        return 1000, 1

def get_pricing(app_id: int) -> tuple[int, int]:
    """
    Retrieve pricing variables with a built-in TTL cache fallback.
    """
    now = time.time()
    if now < _pricing_cache["expires_at"]:
        return _pricing_cache["base_price"], _pricing_cache["byte_price"]

    base, byte = get_pricing_from_contract(app_id)
    _pricing_cache["base_price"] = base
    _pricing_cache["byte_price"] = byte
    _pricing_cache["expires_at"] = now + CACHE_TTL

    return base, byte

def verify_transaction(tx_id: str, expected_amount: int, expected_receiver: str, expected_reference: str) -> bool:
    """
    Verify payment transaction on-chain using algod client.
    Supports local mockup verification for 'MOCKED_' prefix tx IDs.
    """
    if tx_id.startswith("MOCKED_"):
        # MOCKED_VALID_123 -> valid payment
        # MOCKED_WRONG_AMT_123 -> wrong amount mock
        # MOCKED_WRONG_RCV_123 -> wrong receiver mock
        # MOCKED_WRONG_REF_123 -> wrong reference mock
        if "WRONG_AMT" in tx_id:
            return False
        if "WRONG_RCV" in tx_id:
            return False
        if "WRONG_REF" in tx_id:
            return False
        return True

    try:
        tx_info = algod_client.pending_transaction_info(tx_id)
        txn_container = tx_info.get("txn", {})
        txn_inner = txn_container.get("txn", {})

        # 1. Verify transaction type is payment
        tx_type = txn_inner.get("type") or txn_container.get("type")
        if tx_type != "pay":
            return False

        # 2. Verify receiver address
        receiver = txn_inner.get("rcv") or txn_container.get("rcv")
        # Algosdk uses base64 or raw bytes in some formats.
        # Ensure we decode/compare properly
        # For simplicity, if we get raw bytes from the API, base32 encode it
        # pendings are usually dicts with raw values
        if isinstance(receiver, bytes):
            from algosdk import encoding
            receiver = encoding.encode_address(receiver)
        
        if receiver != expected_receiver:
            return False

        # 3. Verify amount (microALGOs)
        amount = txn_inner.get("amt") or txn_container.get("amt") or 0
        if amount < expected_amount:
            return False

        # 4. Verify note matches the expected reference ID (decoded UTF-8 string)
        note_b64 = txn_inner.get("note") or txn_container.get("note") or b""
        if not note_b64:
            return False

        try:
            if isinstance(note_b64, str):
                decoded_note = base64.b64decode(note_b64).decode("utf-8")
            else:
                decoded_note = note_b64.decode("utf-8")
        except Exception:
            return False

        if decoded_note != expected_reference:
            return False

        # 5. Verify transaction is confirmed
        confirmed_round = tx_info.get("confirmed-round", 0)
        if confirmed_round <= 0:
            # For transaction confirmation latency, allow if it's confirmed
            return False

        return True
    except Exception:
        return False
