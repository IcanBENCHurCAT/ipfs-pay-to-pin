import pytest
from fastapi.testclient import TestClient
from gateway.main import app, challenges, spent_txns
from gateway.config import settings

client = TestClient(app)

def test_request_pin_payment_challenge():
    challenges.clear()
    spent_txns.clear()

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
    challenges.clear()
    spent_txns.clear()

    # 1. Create a challenge
    response = client.post(
        "/api/v1/pin",
        files={"file": ("test.txt", b"Hello World", "text/plain")}
    )
    ref_id = response.headers["X-Algorand-Txn-Ref"]

    # 2. Submit valid verification request
    verify_resp = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": "MOCKED_VALID_TX_123"}
    )

    assert verify_resp.status_code == 201
    json_data = verify_resp.json()
    assert json_data["status"] == "success"
    assert json_data["ipfs_cid"] == "QmYwAPJzv5CZ1sAXXtDURmBNBAeXnuL13xNu18q1eLd8d5"
    assert "gateway_url" in json_data

def test_verify_payment_not_found():
    challenges.clear()
    spent_txns.clear()

    verify_resp = client.post(
        "/api/v1/verify",
        json={"reference_id": "non-existent-uuid", "tx_id": "MOCKED_VALID_TX_123"}
    )
    assert verify_resp.status_code == 404
    assert verify_resp.json()["detail"] == "Challenge reference not found."

def test_verify_payment_already_paid():
    challenges.clear()
    spent_txns.clear()

    # Create challenge
    response = client.post(
        "/api/v1/pin",
        files={"file": ("test.txt", b"Hello World", "text/plain")}
    )
    ref_id = response.headers["X-Algorand-Txn-Ref"]

    # First verification - success
    verify_resp1 = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": "MOCKED_VALID_TX_123"}
    )
    assert verify_resp1.status_code == 201

    # Second verification on same challenge - fail (already paid)
    verify_resp2 = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": "MOCKED_VALID_TX_456"}
    )
    assert verify_resp2.status_code == 400
    assert verify_resp2.json()["detail"] == "This challenge has already been paid."

def test_verify_payment_double_spend():
    challenges.clear()
    spent_txns.clear()

    # Create challenge 1
    resp1 = client.post(
        "/api/v1/pin",
        files={"file": ("file1.txt", b"Hello 1", "text/plain")}
    )
    ref_id1 = resp1.headers["X-Algorand-Txn-Ref"]

    # Create challenge 2
    resp2 = client.post(
        "/api/v1/pin",
        files={"file": ("file2.txt", b"Hello 2", "text/plain")}
    )
    ref_id2 = resp2.headers["X-Algorand-Txn-Ref"]

    # Verify challenge 1 with TX_123 - success
    verify_resp1 = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id1, "tx_id": "MOCKED_VALID_TX_123"}
    )
    assert verify_resp1.status_code == 201

    # Verify challenge 2 with SAME TX_123 - fail (double spend)
    verify_resp2 = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id2, "tx_id": "MOCKED_VALID_TX_123"}
    )
    assert verify_resp2.status_code == 400
    assert verify_resp2.json()["detail"] == "Transaction ID has already been spent."

def test_verify_payment_validation_fails():
    challenges.clear()
    spent_txns.clear()

    # Create challenge
    response = client.post(
        "/api/v1/pin",
        files={"file": ("test.txt", b"Hello World", "text/plain")}
    )
    ref_id = response.headers["X-Algorand-Txn-Ref"]

    # Verify with mock TX that triggers verification failure
    verify_resp = client.post(
        "/api/v1/verify",
        json={"reference_id": ref_id, "tx_id": "MOCKED_WRONG_AMT_TX_123"}
    )
    assert verify_resp.status_code == 400
    assert verify_resp.json()["detail"] == "Transaction verification failed."
