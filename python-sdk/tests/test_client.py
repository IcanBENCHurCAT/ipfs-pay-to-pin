import unittest
from unittest.mock import MagicMock, patch
import json
import base64

import requests
from algosdk import account
from algosdk.transaction import SuggestedParams
from ipfs_pay_to_pin_client.client import IpfsPayToPinClient
from ipfs_pay_to_pin_client.exceptions import (
    ExceedsMaxPriceError,
    PaymentRequiredError,
    RekeyDetectedError,
)
from ipfs_pay_to_pin_client.models import PinResponse


class TestIpfsPayToPinClient(unittest.TestCase):
    def setUp(self):
        self.gateway_url = "http://localhost:4021"
        self.private_key, self.sender_address = account.generate_account()

    @patch("algosdk.v2client.algod.AlgodClient")
    @patch("algosdk.mnemonic.to_private_key")
    def test_init(self, mock_to_priv, mock_algod):
        mock_to_priv.return_value = self.private_key
        client = IpfsPayToPinClient(
            gateway_url=self.gateway_url,
            sender_mnemonic="fake mnemonic",
            algod_token="",
            algod_server="http://localhost:4001",
        )
        self.assertEqual(client.gateway_url, "http://localhost:4021")
        self.assertEqual(client.sender_address, self.sender_address)

    def test_init_algosdk_import_error(self):
        real_import = __import__

        def custom_import(name, *args, **kwargs):
            if name.startswith("algosdk"):
                raise ImportError(f"No module named '{name}'")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=custom_import):
            client = IpfsPayToPinClient(
                gateway_url=self.gateway_url,
                sender_mnemonic="fake mnemonic",
            )
            self.assertIsNone(client.sender_address)
            self.assertIsNone(client._algod_client)

    @patch("ipfs_pay_to_pin_client.client.requests.get")
    @patch("algosdk.v2client.algod.AlgodClient")
    @patch("algosdk.mnemonic.to_private_key")
    def test_get_status(self, mock_to_priv, mock_algod, mock_get):
        mock_to_priv.return_value = self.private_key
        mock_response = MagicMock()
        mock_response.json.return_value = {"cid": "QmTest", "status": "pinned"}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        client = IpfsPayToPinClient(gateway_url=self.gateway_url, sender_mnemonic="fake mnemonic")
        res = client.get_status("QmTest")
        self.assertEqual(res["cid"], "QmTest")

    @patch("ipfs_pay_to_pin_client.client.requests.post")
    @patch("algosdk.v2client.algod.AlgodClient")
    @patch("algosdk.mnemonic.to_private_key")
    def test_pin_bytes_max_price_exceeded(self, mock_to_priv, mock_algod, mock_post):
        mock_to_priv.return_value = self.private_key
        mock_algod_inst = MagicMock()
        mock_algod_inst.account_info.return_value = {"auth-addr": None}
        mock_algod.return_value = mock_algod_inst

        mock_402 = MagicMock()
        mock_402.status_code = 402
        challenge_data = {
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "algorand:mainnet",
                    "assetId": 31566704,
                    "amount": 2000000, # 2.0 USDC > max 1.0 USDC
                    "payTo": self.sender_address,
                }
            ]
        }
        mock_402.headers = {"PAYMENT-REQUIRED": base64.b64encode(json.dumps(challenge_data).encode()).decode()}
        mock_post.return_value = mock_402

        client = IpfsPayToPinClient(gateway_url=self.gateway_url, sender_mnemonic="fake mnemonic")
        with self.assertRaises(ExceedsMaxPriceError):
            client.pin_bytes(b"hello world", max_price_usdc=1.0)

    @patch("ipfs_pay_to_pin_client.client.requests.post")
    @patch("algosdk.v2client.algod.AlgodClient")
    @patch("algosdk.mnemonic.to_private_key")
    def test_renew_pin_success(self, mock_to_priv, mock_algod, mock_post):
        mock_to_priv.return_value = self.private_key
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "cid": "QmRenew123",
            "status": "pinned",
            "pin_expires_at": "2026-12-31T23:59:59Z",
            "size_bytes": 1024,
            "tx_id": "tx_renew_abc",
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        client = IpfsPayToPinClient(gateway_url=self.gateway_url, sender_mnemonic="fake mnemonic")
        res = client.renew_pin("QmRenew123")

        self.assertIsInstance(res, PinResponse)
        self.assertEqual(res.cid, "QmRenew123")
        self.assertEqual(res.status, "pinned")
        self.assertEqual(res.pin_expires_at, "2026-12-31T23:59:59Z")
        self.assertEqual(res.size_bytes, 1024)
        self.assertEqual(res.tx_id, "tx_renew_abc")
        mock_post.assert_called_once_with(f"{self.gateway_url}/api/v1/pin/QmRenew123/renew")

    @patch("ipfs_pay_to_pin_client.client.requests.post")
    @patch("algosdk.v2client.algod.AlgodClient")
    @patch("algosdk.mnemonic.to_private_key")
    def test_renew_pin_payment_flow_success(self, mock_to_priv, mock_algod, mock_post):
        mock_to_priv.return_value = self.private_key
        mock_algod_inst = MagicMock()
        mock_algod_inst.suggested_params.return_value = SuggestedParams(
            fee=1000,
            first=1,
            last=1000,
            gh=base64.b64encode(b"a" * 32).decode(),
            gen="mainnet-v1.0",
        )
        mock_algod.return_value = mock_algod_inst

        mock_402 = MagicMock()
        mock_402.status_code = 402
        challenge_data = {
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "algorand:mainnet",
                    "assetId": 31566704,
                    "amount": 500000,
                    "payTo": self.sender_address,
                }
            ]
        }
        mock_402.headers = {"PAYMENT-REQUIRED": base64.b64encode(json.dumps(challenge_data).encode()).decode()}

        mock_200 = MagicMock()
        mock_200.status_code = 200
        mock_200.json.return_value = {
            "cid": "QmRenew402",
            "status": "pinned",
            "pin_expires_at": "2026-12-31T23:59:59Z",
            "size_bytes": 2048,
            "tx_id": "tx_paid_renew",
        }

        mock_post.side_effect = [mock_402, mock_200]

        client = IpfsPayToPinClient(gateway_url=self.gateway_url, sender_mnemonic="fake mnemonic", algod_server="http://localhost:4001")
        res = client.renew_pin("QmRenew402", max_price_usdc=1.0)

        self.assertIsInstance(res, PinResponse)
        self.assertEqual(res.cid, "QmRenew402")
        self.assertEqual(res.status, "pinned")
        self.assertEqual(res.pin_expires_at, "2026-12-31T23:59:59Z")
        self.assertEqual(res.size_bytes, 2048)
        self.assertEqual(res.tx_id, "tx_paid_renew")
        self.assertEqual(mock_post.call_count, 2)

    @patch("ipfs_pay_to_pin_client.client.requests.post")
    @patch("algosdk.v2client.algod.AlgodClient")
    @patch("algosdk.mnemonic.to_private_key")
    def test_renew_pin_max_price_exceeded(self, mock_to_priv, mock_algod, mock_post):
        mock_to_priv.return_value = self.private_key
        mock_algod_inst = MagicMock()
        mock_algod.return_value = mock_algod_inst

        mock_402 = MagicMock()
        mock_402.status_code = 402
        challenge_data = {
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "algorand:mainnet",
                    "assetId": 31566704,
                    "amount": 2000000,
                    "payTo": self.sender_address,
                }
            ]
        }
        mock_402.headers = {"PAYMENT-REQUIRED": base64.b64encode(json.dumps(challenge_data).encode()).decode()}
        mock_post.return_value = mock_402

        client = IpfsPayToPinClient(gateway_url=self.gateway_url, sender_mnemonic="fake mnemonic")
        with self.assertRaises(ExceedsMaxPriceError):
            client.renew_pin("QmRenewExceed", max_price_usdc=1.0)

    @patch("ipfs_pay_to_pin_client.client.requests.post")
    @patch("algosdk.v2client.algod.AlgodClient")
    @patch("algosdk.mnemonic.to_private_key")
    def test_renew_pin_http_error(self, mock_to_priv, mock_algod, mock_post):
        mock_to_priv.return_value = self.private_key
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("404 Not Found")
        mock_post.return_value = mock_response

        client = IpfsPayToPinClient(gateway_url=self.gateway_url, sender_mnemonic="fake mnemonic")
        with self.assertRaises(requests.exceptions.HTTPError):
            client.renew_pin("QmNotFound")

<<<<<<< HEAD
    def test_select_best_option_no_matching_network(self):
        client = IpfsPayToPinClient(gateway_url=self.gateway_url, evm_private_key="0x1111111111111111111111111111111111111111111111111111111111111111")
        accepts = [{"network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "amount": 1000}]
        with self.assertRaises(PaymentRequiredError) as ctx:
            client._select_best_option(accepts)
        self.assertIn("Client has signers for", str(ctx.exception))

    def test_select_best_option_available_networks_filtering(self):
        # Client with EVM key only
        client_evm = IpfsPayToPinClient(gateway_url=self.gateway_url, evm_private_key="0x1111111111111111111111111111111111111111111111111111111111111111")
        accepts = [
            {"network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "amount": 100},
            {"network": "eip155:8453", "amount": 200},
        ]
        res = client_evm._select_best_option(accepts)
        self.assertEqual(res["network"], "eip155:8453")

        # Client with Solana key only
        client_sol = IpfsPayToPinClient(gateway_url=self.gateway_url, solana_private_key="fake_sol_key")
        res_sol = client_sol._select_best_option(accepts)
        self.assertEqual(res_sol["network"], "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")

    def test_select_best_option_preferred_network(self):
        client = IpfsPayToPinClient(
            gateway_url=self.gateway_url,
            evm_private_key="0x1111111111111111111111111111111111111111111111111111111111111111",
            preferred_network="eip155:1",
        )
        accepts = [
            {"network": "eip155:8453", "amount": 100}, # lower amount and higher priority normally
            {"network": "eip155:1", "amount": 500},
        ]
        res = client._select_best_option(accepts)
        self.assertEqual(res["network"], "eip155:1")

    @patch("algosdk.mnemonic.to_private_key")
    def test_select_best_option_sorting_by_amount_and_priority(self, mock_to_priv):
        mock_to_priv.return_value = self.private_key
        # When amounts are equal, sort by priority rank:
        # eip155:8453 (1) < solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp (2) < algorand:mainnet (3) < eip155:42161 (4) < eip155:1 (5)
        client = IpfsPayToPinClient(
            gateway_url=self.gateway_url,
            evm_private_key="0x1111111111111111111111111111111111111111111111111111111111111111",
            solana_private_key="fake_sol_key",
            sender_mnemonic="fake mnemonic",
        )
        accepts_same_amount = [
            {"network": "eip155:1", "amount": 1000},
            {"network": "eip155:42161", "amount": 1000},
            {"network": "algorand:mainnet", "amount": 1000},
            {"network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "amount": 1000},
            {"network": "eip155:8453", "amount": 1000},
        ]
        res = client._select_best_option(accepts_same_amount)
        self.assertEqual(res["network"], "eip155:8453")

        # Lower amount wins regardless of priority
        accepts_diff_amount = [
            {"network": "eip155:8453", "amount": 5000},
            {"network": "eip155:1", "amount": 500}, # lowest amount
        ]
        res_diff = client._select_best_option(accepts_diff_amount)
        self.assertEqual(res_diff["network"], "eip155:1")
=======
    @patch.object(IpfsPayToPinClient, "pin_bytes")
    @patch("algosdk.v2client.algod.AlgodClient")
    @patch("algosdk.mnemonic.to_private_key")
    def test_pin_file_success(self, mock_to_priv, mock_algod, mock_pin_bytes):
        mock_to_priv.return_value = self.private_key
        mock_response = PinResponse(
            cid="QmFile123",
            status="pinned",
            pin_expires_at="2026-12-31T23:59:59Z",
            size_bytes=11,
            tx_id="tx_file_123",
        )
        mock_pin_bytes.return_value = mock_response

        client = IpfsPayToPinClient(gateway_url=self.gateway_url, sender_mnemonic="fake mnemonic")

        with patch("builtins.open", unittest.mock.mock_open(read_data=b"hello world")):
            res = client.pin_file("/path/to/test_document.pdf", max_price_usdc=0.5)

        self.assertEqual(res, mock_response)
        mock_pin_bytes.assert_called_once_with(
            b"hello world",
            filename="test_document.pdf",
            max_price_usdc=0.5,
        )

    @patch("algosdk.v2client.algod.AlgodClient")
    @patch("algosdk.mnemonic.to_private_key")
    def test_pin_file_not_found(self, mock_to_priv, mock_algod):
        mock_to_priv.return_value = self.private_key
        client = IpfsPayToPinClient(gateway_url=self.gateway_url, sender_mnemonic="fake mnemonic")

        with self.assertRaises(FileNotFoundError):
            client.pin_file("/nonexistent/file/path/missing.txt")
>>>>>>> c841ebd (🐧 Tux: Add unit tests for pin_file in Python SDK)


if __name__ == "__main__":
    unittest.main()
