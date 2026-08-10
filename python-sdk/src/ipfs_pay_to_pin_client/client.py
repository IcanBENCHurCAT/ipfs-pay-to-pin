import base64
import json
import os
from typing import Optional, Union

import requests
from algosdk import account, mnemonic
from algosdk.v2client.algod import AlgodClient
from algosdk.transaction import AssetTransferTxn, PaymentTxn

from .exceptions import (
    ExceedsMaxPriceError,
    InsufficientFundsError,
    PaymentRequiredError,
    PayToPinError,
    PinningFailedError,
    RekeyDetectedError,
)
from .models import PinResponse


class IpfsPayToPinClient:
    def __init__(
        self,
        gateway_url: str,
        sender_mnemonic: str,
        algod_server: str = "https://testnet-api.algonode.cloud",
        algod_token: str = "",
    ):
        self.gateway_url = gateway_url.rstrip("/")
        self.private_key = mnemonic.to_private_key(sender_mnemonic)
        self.sender_address = account.address_from_private_key(self.private_key)
        self.algod_client = AlgodClient(algod_token, algod_server)

    def _verify_account_health(self):
        acc_info = self.algod_client.account_info(self.sender_address)
        if acc_info.get("auth-addr"):
            raise RekeyDetectedError(
                f"Account {self.sender_address} has been rekeyed to {acc_info['auth-addr']}. "
                "Signing denied for security."
            )
        return acc_info

    def get_status(self, cid: str) -> dict:
        url = f"{self.gateway_url}/api/v1/pin/{cid}"
        resp = requests.get(url)
        resp.raise_for_status()
        return resp.json()

    def renew_pin(self, cid: str, max_price_usdc: Optional[float] = None) -> PinResponse:
        url = f"{self.gateway_url}/api/v1/pin/{cid}/renew"
        resp = requests.post(url)
        if resp.status_code == 402:
            return self._handle_payment_flow(url, {}, resp, max_price_usdc=max_price_usdc)
        resp.raise_for_status()
        data = resp.json()
        return PinResponse(
            cid=data.get("cid", cid),
            status=data.get("status", "pinned"),
            pin_expires_at=data.get("pin_expires_at", ""),
            size_bytes=data.get("size_bytes", 0),
            tx_id=data.get("tx_id"),
        )

    def pin_bytes(
        self,
        data: bytes,
        filename: str = "file.bin",
        max_price_usdc: Optional[float] = None,
    ) -> PinResponse:
        b64_content = base64.b64encode(data).decode("utf-8")
        payload = {
            "file": b64_content,
            "filename": filename,
        }
        url = f"{self.gateway_url}/api/v1/pin"
        resp = requests.post(url, json=payload)
        if resp.status_code == 402:
            return self._handle_payment_flow(url, payload, resp, max_price_usdc=max_price_usdc)
        
        if resp.status_code == 200 or resp.status_code == 201:
            res_json = resp.json()
            return PinResponse(
                cid=res_json["cid"],
                status=res_json.get("status", "pinned"),
                pin_expires_at=res_json.get("pin_expires_at", ""),
                size_bytes=res_json.get("size_bytes", len(data)),
                tx_id=res_json.get("tx_id"),
            )
        
        raise PinningFailedError(f"Pinning failed with status {resp.status_code}: {resp.text}")

    def pin_file(
        self,
        file_path: str,
        max_price_usdc: Optional[float] = None,
    ) -> PinResponse:
        filename = os.path.basename(file_path)
        with open(file_path, "rb") as f:
            content = f.read()
        return self.pin_bytes(content, filename=filename, max_price_usdc=max_price_usdc)

    def _handle_payment_flow(
        self,
        url: str,
        payload: dict,
        initial_resp: requests.Response,
        max_price_usdc: Optional[float] = None,
    ) -> PinResponse:
        self._verify_account_health()

        hdr = initial_resp.headers.get("PAYMENT-REQUIRED")
        if not hdr:
            raise PaymentRequiredError("402 status returned but PAYMENT-REQUIRED header missing.")

        try:
            challenge = json.loads(base64.b64decode(hdr).decode("utf-8"))
        except Exception as e:
            raise PaymentRequiredError(f"Failed to decode PAYMENT-REQUIRED header challenge: {e}")

        accepts = challenge.get("accepts", [])
        if not accepts:
            raise PaymentRequiredError("No payment options specified in x402 challenge.")

        payment_opt = accepts[0]
        amount_micro_usdc = payment_opt["amount"]
        recipient = payment_opt["payTo"]
        asset_id = payment_opt["assetId"]

        # Check max_price limit
        amount_usdc = amount_micro_usdc / 1_000_000.0
        if max_price_usdc is not None and amount_usdc > max_price_usdc:
            raise ExceedsMaxPriceError(
                f"Requested payment ({amount_usdc} USDC) exceeds max_price_usdc ceiling ({max_price_usdc} USDC)."
            )

        # Build and sign Algorand Asset Transfer transaction
        params = self.algod_client.suggested_params()
        txn = AssetTransferTxn(
            sender=self.sender_address,
            sp=params,
            receiver=recipient,
            amt=amount_micro_usdc,
            index=asset_id,
        )
        stxn = txn.sign(self.private_key)
        signed_b64 = base64.b64encode(stxn.to_byte_array()).decode("utf-8")

        sig_header = json.dumps({"signedTransaction": signed_b64})
        sig_header_b64 = base64.b64encode(sig_header.encode()).decode()

        headers = {"PAYMENT-SIGNATURE": sig_header_b64}
        paid_resp = requests.post(url, json=payload, headers=headers)
        
        if paid_resp.status_code in (200, 201):
            res_json = paid_resp.json()
            return PinResponse(
                cid=res_json["cid"],
                status=res_json.get("status", "pinned"),
                pin_expires_at=res_json.get("pin_expires_at", ""),
                size_bytes=res_json.get("size_bytes", 0),
                tx_id=res_json.get("tx_id"),
            )

        raise PinningFailedError(f"Post-payment request failed with status {paid_resp.status_code}: {paid_resp.text}")
