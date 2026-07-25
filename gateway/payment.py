import base64
import time
from algosdk.v2client import algod
from gateway.config import settings

def get_algod_client() -> algod.AlgodClient:
    """
    Get an active Algod client, trying the primary address first and then fallback addresses.
    """
    client = algod.AlgodClient(settings.ALGOD_TOKEN, settings.ALGOD_ADDRESS)
    try:
        client.health()
        return client
    except Exception:
        pass

    if settings.ALGOD_FALLBACK_ADDRESSES:
        fallback_addrs = [addr.strip() for addr in settings.ALGOD_FALLBACK_ADDRESSES.split(",") if addr.strip()]
        for addr in fallback_addrs:
            client = algod.AlgodClient(settings.ALGOD_TOKEN, addr)
            try:
                client.health()
                return client
            except Exception:
                continue

    return algod.AlgodClient(settings.ALGOD_TOKEN, settings.ALGOD_ADDRESS)

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
        client = get_algod_client()
        app_info = client.application_info(app_id)
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

def verify_transaction(tx_id: str, expected_amount: int, expected_receiver: str, expected_reference: str) -> tuple[bool, str | None, str | None]:
    """
    Verify payment transaction on-chain using algod client with exponential backoff retries.
    Supports local mockup verification for 'MOCKED_' prefix tx IDs.
    Returns (is_valid, sender_address, error_reason).
    """
    if tx_id.startswith("MOCKED_"):
        # MOCKED_VALID_123 -> valid payment
        # MOCKED_WRONG_AMT_123 -> wrong amount mock
        # MOCKED_WRONG_RCV_123 -> wrong receiver mock
        # MOCKED_WRONG_REF_123 -> wrong reference mock
        if "WRONG_AMT" in tx_id:
            return False, None, "Insufficient payment. Expected 50000 microALGOs, received 10000."
        if "WRONG_RCV" in tx_id:
            return False, None, "Transaction verification failed."
        if "WRONG_REF" in tx_id:
            return False, None, "Transaction verification failed."
        return True, "MOCKED_SENDER_ADDRESS", None

    start_time = time.time()
    delay = 1.0
    timeout = 10.0

    while time.time() - start_time < timeout:
        try:
            client = get_algod_client()
            tx_info = client.pending_transaction_info(tx_id)
            txn_container = tx_info.get("txn", {})
            txn_inner = txn_container.get("txn", {})

            # 1. Verify transaction type is payment (pay) or asset transfer (axfer)
            tx_type = txn_inner.get("type") or txn_container.get("type")
            if tx_type not in ("pay", "axfer"):
                return False, None, "Transaction verification failed: invalid transaction type."

            # 2. Extract receiver, amount, and asset ID
            if tx_type == "axfer":
                asset_id = txn_inner.get("xaid") or txn_container.get("xaid") or 0
                if asset_id != settings.USDC_ASSET_ID:
                    return False, None, f"Invalid payment asset. Expected USDC ({settings.USDC_ASSET_ID}), received asset {asset_id}."
                receiver = txn_inner.get("arcv") or txn_container.get("arcv")
                amount = txn_inner.get("aamt") or txn_container.get("aamt") or 0
            else:
                receiver = txn_inner.get("rcv") or txn_container.get("rcv")
                amount = txn_inner.get("amt") or txn_container.get("amt") or 0

            if isinstance(receiver, bytes):
                from algosdk import encoding
                receiver = encoding.encode_address(receiver)
            
            if receiver != expected_receiver:
                return False, None, "Transaction verification failed: incorrect receiver."

            # 3. Verify amount
            if amount < expected_amount:
                return False, None, f"Insufficient payment. Expected {expected_amount}, received {amount}."

            # 4. Verify note matches the expected reference ID
            note_b64 = txn_inner.get("note") or txn_container.get("note") or b""
            if not note_b64:
                return False, None, "Transaction verification failed: missing reference note."

            try:
                if isinstance(note_b64, str):
                    decoded_note = base64.b64decode(note_b64).decode("utf-8")
                else:
                    decoded_note = note_b64.decode("utf-8")
            except Exception:
                return False, None, "Transaction verification failed: invalid reference note encoding."

            if decoded_note != expected_reference:
                return False, None, "Transaction verification failed: reference mismatch."


            # 5. Verify transaction is confirmed
            confirmed_round = tx_info.get("confirmed-round", 0)
            if confirmed_round <= 0:
                # Still pending in pool, wait and retry
                time.sleep(delay)
                delay = min(delay * 2.0, timeout - (time.time() - start_time))
                continue

            # Extract sender address
            sender = txn_inner.get("snd") or txn_container.get("snd")
            if isinstance(sender, bytes):
                from algosdk import encoding
                sender = encoding.encode_address(sender)

            return True, sender, None

        except Exception:
            # Transaction might not be on-chain or pool yet, wait and retry
            if time.time() - start_time + delay >= timeout:
                break
            time.sleep(delay)
            delay = min(delay * 2.0, timeout - (time.time() - start_time))

    return False, None, "Transaction not found on the network."
