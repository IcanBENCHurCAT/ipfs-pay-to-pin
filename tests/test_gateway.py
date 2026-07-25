import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from gateway.main import app, challenges
from gateway.config import settings
from gateway.database import init_db, get_database_adapter, SQLiteDatabaseAdapter, SupabaseDatabaseAdapter

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_and_cleanup_db():
    # Initialize the database schema
    adapter = get_database_adapter()
    adapter.init_db()
    
    # Clean tables if running on SQLite
    if isinstance(adapter, SQLiteDatabaseAdapter):
        conn = adapter.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM processed_transactions")
        cursor.execute("DELETE FROM verification_challenges")
        conn.commit()
        conn.close()

    # Clear in-memory challenges cache
    challenges.clear()
    yield

def test_database_adapter_factory():
    with patch.object(settings, "DATABASE_ADAPTER", "sqlite"):
        adapter = get_database_adapter()
        assert isinstance(adapter, SQLiteDatabaseAdapter)

    with patch.object(settings, "DATABASE_ADAPTER", "supabase"):
        adapter = get_database_adapter()
        assert isinstance(adapter, SupabaseDatabaseAdapter)

def test_request_pin_payment_challenge():
    file_content = b"Hello World"
    file_size = len(file_content)

    response = client.post(
        "/api/v1/pin",
        files={"file": ("test.txt", file_content, "text/plain")}
    )

    assert response.status_code == 402

    # Verify custom HTTP x402 headers
    assert "X-Algorand-Address" in response.headers
    assert response.headers["X-Algorand-Address"] == settings.ESCROW_ADDRESS
    assert "X-Algorand-Amount" in response.headers
    assert "X-Algorand-Txn-Ref" in response.headers

    # Verify JSON payload
    json_data = response.json()
    assert json_data["message"] == "Payment required to pin file."
    assert json_data["currency"] == "microALGO"
    assert json_data["escrow"] == settings.ESCROW_ADDRESS
    assert "reference_id" in json_data
    assert json_data["reference_id"] == response.headers["X-Algorand-Txn-Ref"]

    # Verify expected calculated fee: base_price + size * byte_price
    expected_amount = 1000 + file_size
    assert int(response.headers["X-Algorand-Amount"]) == expected_amount
    assert json_data["amount"] == expected_amount

def test_verify_payment_success():
    response = client.post(
        "/api/v1/pin",
        files={"file": ("test.txt", b"Hello World", "text/plain")}
    )
    ref_id = response.headers["X-Algorand-Txn-Ref"]

    verify_resp = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": "MOCKED_VALID_TX_123"}
    )

    assert verify_resp.status_code == 201
    json_data = verify_resp.json()
    assert json_data["status"] == "success"
    assert len(json_data["ipfs_cid"]) == 52
    assert "gateway_url" in json_data

def test_verify_payment_not_found():
    verify_resp = client.post(
        "/api/v1/verify",
        json={"reference_id": "non-existent-uuid", "tx_id": "MOCKED_VALID_TX_123"}
    )
    assert verify_resp.status_code == 404
    assert verify_resp.json()["detail"] == "Challenge reference not found."

def test_verify_payment_already_paid():
    response = client.post(
        "/api/v1/pin",
        files={"file": ("test.txt", b"Hello World", "text/plain")}
    )
    ref_id = response.headers["X-Algorand-Txn-Ref"]

    verify_resp1 = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": "MOCKED_VALID_TX_123"}
    )
    assert verify_resp1.status_code == 201

    verify_resp2 = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": "MOCKED_VALID_TX_456"}
    )
    assert verify_resp2.status_code == 400
    assert verify_resp2.json()["detail"] == "This challenge has already been paid."

def test_verify_payment_double_spend():
    resp1 = client.post(
        "/api/v1/pin",
        files={"file": ("file1.txt", b"Hello 1", "text/plain")}
    )
    ref_id1 = resp1.headers["X-Algorand-Txn-Ref"]

    resp2 = client.post(
        "/api/v1/pin",
        files={"file": ("file2.txt", b"Hello 2", "text/plain")}
    )
    ref_id2 = resp2.headers["X-Algorand-Txn-Ref"]

    verify_resp1 = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id1, "tx_id": "MOCKED_VALID_TX_123"}
    )
    assert verify_resp1.status_code == 201

    verify_resp2 = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id2, "tx_id": "MOCKED_VALID_TX_123"}
    )
    assert verify_resp2.status_code == 400
    assert verify_resp2.json()["detail"] == "Double-spend detected: Transaction already processed."

def test_verify_payment_validation_fails():
    response = client.post(
        "/api/v1/pin",
        files={"file": ("test.txt", b"Hello World", "text/plain")}
    )
    ref_id = response.headers["X-Algorand-Txn-Ref"]

    verify_resp = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": "MOCKED_WRONG_AMT_TX_123"}
    )
    assert verify_resp.status_code == 402
    assert "Insufficient payment" in verify_resp.json()["detail"]
