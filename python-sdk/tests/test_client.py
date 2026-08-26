import unittest
from unittest.mock import MagicMock, patch
import json
import base64

from algosdk import account
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


if __name__ == "__main__":
    unittest.main()
