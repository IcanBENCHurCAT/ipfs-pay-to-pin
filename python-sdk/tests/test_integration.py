"""Integration tests for Python SDK pin_files() — end-to-end payload validation.

These tests validate that the Python SDK's pin_files() method sends payloads
that match the server's expected format (POST /api/v1/pins), and correctly
parses server responses back into BatchPinResponse.

Tests use the requests mock to simulate the full HTTP request/response cycle
without needing a live server, but validate the exact payload structure that
would be sent to the server.
"""
import json
import base64
import unittest
from unittest.mock import MagicMock, patch
from ipfs_pay_to_pin_client.client import IpfsPayToPinClient
from ipfs_pay_to_pin_client.models import BatchPinResponse, BatchPinResult


class TestPinFilesPayloadStructure(unittest.TestCase):
    """Validate that pin_files() sends correct payload structure matching server expectations."""

    def setUp(self):
        # Provide a dummy EVM key so client instantiation doesn't require a real wallet.
        # All HTTP calls are mocked, so this is safe for unit testing.
        self.client = IpfsPayToPinClient(
            gateway_url="http://localhost:4021",
            evm_private_key="0x0000000000000000000000000000000000000000000000000000000000000001",
        )

    def test_bare_array_payload_no_webhook(self):
        """Without webhook_url, SDK should send bare array: [{filename, data}]
        This matches server's Array.isArray(body) check in index.ts."""
        with patch("builtins.open", unittest.mock.mock_open(read_data=b"hello")):
            with patch("ipfs_pay_to_pin_client.client.requests.post") as mock_post:
                mock_resp = MagicMock()
                mock_resp.status_code = 201
                mock_resp.json.return_value = {
                    "pins": [{"cid": "QmTest", "gateway_url": "https://ipfs.io/ipfs/QmTest", "expires_at": "2027-01-01T00:00:00Z"}],
                    "total": 1, "succeeded": 1, "failed": 0,
                }
                mock_post.return_value = mock_resp

                res = self.client.pin_files(["/path/to/file.txt"])

                # Verify payload structure
                call_args = mock_post.call_args
                payload = call_args[1]["json"]

                # Must be a list (bare array), NOT an object
                self.assertIsInstance(payload, list, "Payload without webhook must be a bare array")
                self.assertEqual(len(payload), 1)
                self.assertIn("filename", payload[0])
                self.assertIn("data", payload[0])
                self.assertEqual(payload[0]["filename"], "file.txt")
                self.assertEqual(base64.b64decode(payload[0]["data"]), b"hello")

                # Verify response parsing
                self.assertIsInstance(res, BatchPinResponse)
                self.assertEqual(res.total, 1)
                self.assertEqual(res.succeeded, 1)
                self.assertEqual(res.failed, 0)
                self.assertEqual(len(res.pins), 1)
                self.assertEqual(res.pins[0].cid, "QmTest")

    def test_wrapped_payload_with_webhook(self):
        """With webhook_url, SDK should send: {files: [...], webhook_url: "..."}
        This matches server's extraction at index.ts line 957-958:
          webhookUrl = body.webhook_url
          files = body.files || body.items"""
        with patch("builtins.open", unittest.mock.mock_open(read_data=b"hello")):
            with patch("ipfs_pay_to_pin_client.client.requests.post") as mock_post:
                mock_resp = MagicMock()
                mock_resp.status_code = 201
                mock_resp.json.return_value = {
                    "pins": [{"cid": "QmWebhook", "gateway_url": "https://ipfs.io/ipfs/QmWebhook", "expires_at": "2027-01-01T00:00:00Z"}],
                    "total": 1, "succeeded": 1, "failed": 0,
                }
                mock_post.return_value = mock_resp

                res = self.client.pin_files(
                    ["/path/to/file.txt"],
                    webhook_url="https://example.com/webhook"
                )

                # Verify payload structure
                call_args = mock_post.call_args
                payload = call_args[1]["json"]

                # Must be an object with files and webhook_url
                self.assertIsInstance(payload, dict)
                self.assertIn("files", payload)
                self.assertIn("webhook_url", payload)
                self.assertEqual(payload["webhook_url"], "https://example.com/webhook")
                self.assertEqual(len(payload["files"]), 1)
                self.assertEqual(payload["files"][0]["filename"], "file.txt")

                # Verify response parsing
                self.assertIsInstance(res, BatchPinResponse)
                self.assertEqual(res.total, 1)
                self.assertEqual(res.succeeded, 1)

    def test_mixed_input_format(self):
        """SDK should handle mixed string paths and (filename, bytes) tuples."""
        with patch("builtins.open", unittest.mock.mock_open(read_data=b"from_file")):
            with patch("ipfs_pay_to_pin_client.client.requests.post") as mock_post:
                mock_resp = MagicMock()
                mock_resp.status_code = 201
                mock_resp.json.return_value = {
                    "pins": [
                        {"cid": "Qm1", "gateway_url": "https://ipfs.io/ipfs/Qm1", "expires_at": "2027-01-01T00:00:00Z"},
                        {"cid": "Qm2", "gateway_url": "https://ipfs.io/ipfs/Qm2", "expires_at": "2027-01-01T00:00:00Z"},
                        {"cid": "Qm3", "gateway_url": "https://ipfs.io/ipfs/Qm3", "expires_at": "2027-01-01T00:00:00Z"},
                    ],
                    "total": 3, "succeeded": 3, "failed": 0,
                }
                mock_post.return_value = mock_resp

                res = self.client.pin_files([
                    "/path/to/file.txt",           # string path
                    ("inline.bin", b"inline data"), # tuple
                ])

                # Verify both formats were encoded
                call_args = mock_post.call_args
                payload = call_args[1]["json"]

                self.assertIsInstance(payload, list)
                self.assertEqual(len(payload), 2)
                self.assertEqual(payload[0]["filename"], "file.txt")
                self.assertEqual(base64.b64decode(payload[0]["data"]), b"from_file")
                self.assertEqual(payload[1]["filename"], "inline.bin")
                self.assertEqual(base64.b64decode(payload[1]["data"]), b"inline data")

    def test_response_parsing_partial_success(self):
        """SDK should correctly parse 207 partial success response."""
        with patch("builtins.open", unittest.mock.mock_open(read_data=b"data")):
            with patch("ipfs_pay_to_pin_client.client.requests.post") as mock_post:
                mock_resp = MagicMock()
                mock_resp.status_code = 207
                mock_resp.json.return_value = {
                    "pins": [
                        {"cid": "QmGood", "gateway_url": "https://ipfs.io/ipfs/QmGood", "expires_at": "2027-01-01T00:00:00Z"},
                        {"filename": "bad.txt", "error": "Invalid base64 data"},
                        {"cid": "QmGood2", "gateway_url": "https://ipfs.io/ipfs/QmGood2", "expires_at": "2027-01-01T00:00:00Z"},
                    ],
                    "total": 3, "succeeded": 2, "failed": 1,
                }
                mock_post.return_value = mock_resp

                res = self.client.pin_files(["/good.txt", "bad.txt", "/good2.txt"])

                self.assertEqual(res.total, 3)
                self.assertEqual(res.succeeded, 2)
                self.assertEqual(res.failed, 1)
                self.assertEqual(len(res.pins), 3)
                # First success
                self.assertEqual(res.pins[0].cid, "QmGood")
                self.assertTrue(res.pins[0].success)
                # Second failure
                self.assertIsNone(res.pins[1].cid)
                self.assertFalse(res.pins[1].success)
                self.assertEqual(res.pins[1].error, "Invalid base64 data")
                self.assertEqual(res.pins[1].filename, "bad.txt")
                # Third success
                self.assertEqual(res.pins[2].cid, "QmGood2")

    def test_response_parsing_single_result(self):
        """SDK should handle single-result responses correctly."""
        with patch("builtins.open", unittest.mock.mock_open(read_data=b"data")):
            with patch("ipfs_pay_to_pin_client.client.requests.post") as mock_post:
                mock_resp = MagicMock()
                mock_resp.status_code = 201
                mock_resp.json.return_value = {
                    "pins": [
                        {"cid": "QmSingle", "gateway_url": "https://ipfs.io/ipfs/QmSingle", "expires_at": "2027-01-01T00:00:00Z"},
                    ],
                    "total": 1, "succeeded": 1, "failed": 0,
                }
                mock_post.return_value = mock_resp

                res = self.client.pin_files(["/single.txt"])

                self.assertEqual(res.total, 1)
                self.assertEqual(res.succeeded, 1)
                self.assertEqual(res.failed, 0)
                self.assertEqual(len(res.pins), 1)
                self.assertEqual(res.pins[0].cid, "QmSingle")
                self.assertEqual(res.pins[0].gateway_url, "https://ipfs.io/ipfs/QmSingle")


class TestPinFilesPaymentFlow(unittest.TestCase):
    """Validate that pin_files() correctly handles x402 payment flow."""

    def setUp(self):
        # Use a dummy EVM key — Account is imported inside _build_payment_signature,
        # so we patch it at the eth_account module level where the import happens.
        self.evm_key = "0x0000000000000000000000000000000000000000000000000000000000000001"
        with patch("eth_account.Account") as mock_account_class:
            mock_account = MagicMock()
            mock_account.address = "0xDeadC0de00000000000000000000000000000000"
            mock_account_class.from_key.return_value = mock_account
            self.client = IpfsPayToPinClient(
                gateway_url="http://localhost:4021",
                evm_private_key=self.evm_key,
            )

    def test_402_triggers_payment_flow(self):
        """When server returns 402, SDK should send signed payment and retry."""
        with patch("builtins.open", unittest.mock.mock_open(read_data=b"data")):
            with patch("ipfs_pay_to_pin_client.client.requests.post") as mock_post:
                # First call: 402 challenge
                mock_402 = MagicMock()
                mock_402.status_code = 402
                # Use EVM network to match the client's evm_private_key capability
                challenge = {
                    "accepts": [
                        {
                            "scheme": "exact",
                            "network": "eip155:1",
                            "payTo": "0xReceiver000000000000000000000000000000",
                            "amount": 500000,
                        }
                    ]
                }
                mock_402.headers = {
                    "PAYMENT-REQUIRED": base64.b64encode(json.dumps(challenge).encode()).decode()
                }

                # Second call: success after payment
                mock_201 = MagicMock()
                mock_201.status_code = 201
                mock_201.json.return_value = {
                    "pins": [{"cid": "QmPaid", "gateway_url": "https://ipfs.io/ipfs/QmPaid", "expires_at": "2027-01-01T00:00:00Z"}],
                    "total": 1, "succeeded": 1, "failed": 0,
                }

                mock_post.side_effect = [mock_402, mock_201]

                res = self.client.pin_files(["/paid.txt"])

                # Verify two requests were made
                self.assertEqual(mock_post.call_count, 2)

                # Verify second request includes PAYMENT-SIGNATURE header
                second_call = mock_post.call_args_list[1]
                headers = second_call[1].get("headers", {})
                self.assertIn("PAYMENT-SIGNATURE", headers)

                # Verify response
                self.assertEqual(res.succeeded, 1)
                self.assertEqual(res.pins[0].cid, "QmPaid")

    def test_402_exceeds_max_price(self):
        """When payment amount exceeds max_price_usdc, SDK should raise ExceedsMaxPriceError."""
        with patch("builtins.open", unittest.mock.mock_open(read_data=b"data")):
            with patch("ipfs_pay_to_pin_client.client.requests.post") as mock_post:
                mock_402 = MagicMock()
                mock_402.status_code = 402
                # Use EVM network to match the client's evm_private_key capability
                challenge = {
                    "accepts": [
                        {
                            "scheme": "exact",
                            "network": "eip155:1",
                            "payTo": "0xReceiver000000000000000000000000000000",
                            "amount": 10000000,  # 10.0 USDC
                        }
                    ]
                }
                mock_402.headers = {
                    "PAYMENT-REQUIRED": base64.b64encode(json.dumps(challenge).encode()).decode()
                }
                mock_post.return_value = mock_402

                from ipfs_pay_to_pin_client.exceptions import ExceedsMaxPriceError

                with self.assertRaises(ExceedsMaxPriceError):
                    self.client.pin_files(["/expensive.txt"], max_price_usdc=1.0)


class TestPinFilesServerErrorHandling(unittest.TestCase):
    """Validate that pin_files() handles server errors correctly."""

    def setUp(self):
        self.client = IpfsPayToPinClient(
            gateway_url="http://localhost:4021",
            evm_private_key="0x0000000000000000000000000000000000000000000000000000000000000001",
        )

    def test_invalid_batch_rejected(self):
        """SDK should raise ValueError for invalid input (not string or tuple)."""
        with self.assertRaises(ValueError) as ctx:
            self.client.pin_files([{"not": "valid"}])
        self.assertIn("must be a string path or", str(ctx.exception))

    def test_non_array_input_rejected(self):
        """SDK should raise ValueError for non-list input."""
        with self.assertRaises(ValueError) as ctx:
            self.client.pin_files("not a list")
        self.assertIn("must be a list", str(ctx.exception))

    def test_http_error_propagates(self):
        """SDK should raise PinningFailedError for non-success HTTP status."""
        with patch("builtins.open", unittest.mock.mock_open(read_data=b"data")):
            with patch("ipfs_pay_to_pin_client.client.requests.post") as mock_post:
                mock_resp = MagicMock()
                mock_resp.status_code = 500
                mock_resp.text = "Internal Server Error"
                mock_post.return_value = mock_resp

                with self.assertRaises(Exception) as ctx:
                    self.client.pin_files(["/error.txt"])
                self.assertIn("500", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
