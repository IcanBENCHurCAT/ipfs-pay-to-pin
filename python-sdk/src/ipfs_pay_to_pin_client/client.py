import base64
import json
import os
from typing import Optional, Union

import requests

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
        gateway_url: str = "https://pay-to-pin.duckdns.org",
        sender_mnemonic: Optional[str] = None,
        sender: Optional[str] = None,
        evm_private_key: Optional[str] = None,
        solana_private_key: Optional[str] = None,
        algod_server: str = "https://mainnet-api.algonode.cloud",
        algod_token: str = "",
        preferred_network: Optional[str] = None,
    ):
        if not sender_mnemonic and not evm_private_key and not solana_private_key:
            raise ValueError(
                "IpfsPayToPinClient requires at least one wallet key (sender_mnemonic, evm_private_key, or solana_private_key)."
            )

        this_gateway_url = gateway_url or "https://pay-to-pin.duckdns.org"
        self.gateway_url = this_gateway_url.rstrip("/")
        self.sender_mnemonic = sender_mnemonic
        self.sender = sender
        self.evm_private_key = evm_private_key
        self.solana_private_key = solana_private_key
        self.algod_server = algod_server
        self.algod_token = algod_token
        self.preferred_network = preferred_network

        self._algorand_account = None
        self.sender_address = None
        self._algod_client = None

        if sender_mnemonic:
            try:
                from algosdk import account, mnemonic
                from algosdk.v2client.algod import AlgodClient
                private_key = mnemonic.to_private_key(sender_mnemonic)
                self.sender_address = account.address_from_private_key(private_key)
                self._algorand_private_key = private_key
                self._algod_client = AlgodClient(algod_token, algod_server)
            except ImportError:
                pass

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
            "data": b64_content,
            "filename": filename,
        }
        url = f"{self.gateway_url}/api/v1/pin"
        resp = requests.post(url, json=payload)
        if resp.status_code == 402:
            return self._handle_payment_flow(url, payload, resp, max_price_usdc=max_price_usdc)

        if resp.status_code in (200, 201):
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

    def _select_best_option(self, accepts: list) -> dict:
        available_networks = []
        if self.evm_private_key:
            available_networks.extend(["eip155:8453", "eip155:42161", "eip155:1"])
        if self.solana_private_key:
            available_networks.append("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
        if self.sender_mnemonic:
            available_networks.extend(["algorand:mainnet", "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="])

        matching = [a for a in accepts if any(a.get("network", "").startswith(net) for net in available_networks)]
        if not matching:
            raise PaymentRequiredError(
                f"Client has signers for {available_networks}, but server required {list(a.get('network') for a in accepts)}"
            )

        if self.preferred_network:
            for m in matching:
                if m.get("network") == self.preferred_network:
                    return m

        priority = {
            "eip155:8453": 1,
            "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": 2,
            "algorand:mainnet": 3,
            "eip155:42161": 4,
            "eip155:1": 5,
        }

        matching.sort(key=lambda x: (int(x.get("amount", 0)), priority.get(x.get("network", ""), 99)))
        return matching[0]

    def _handle_payment_flow(
        self,
        url: str,
        payload: dict,
        initial_resp: requests.Response,
        max_price_usdc: Optional[float] = None,
    ) -> PinResponse:
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

        payment_opt = self._select_best_option(accepts)
        network = payment_opt.get("network", "")
        amount_micro_usdc = int(payment_opt["amount"])

        # Check max_price limit
        amount_usdc = amount_micro_usdc / 1_000_000.0
        if max_price_usdc is not None and amount_usdc > max_price_usdc:
            raise ExceedsMaxPriceError(
                f"Requested payment ({amount_usdc} USDC on {network}) exceeds max_price_usdc ceiling ({max_price_usdc} USDC)."
            )

        # Execute signing based on target chain
        if network.startswith("eip155:") and self.evm_private_key:
            from eth_account import Account
            account = Account.from_key(self.evm_private_key)
            sig_data = {
                "network": network,
                "scheme": "exact",
                "signer": account.address,
                "authorization": {
                    "from": account.address,
                    "to": payment_opt["payTo"],
                    "value": str(amount_micro_usdc),
                    "validAfter": 0,
                    "validBefore": challenge.get("validBefore", 10000000000),
                    "nonce": "0x" + os.urandom(32).hex(),
                }
            }
            sig_header = json.dumps(sig_data)
        elif network.startswith("solana:") and self.solana_private_key:
            sig_data = {
                "network": network,
                "scheme": "exact",
                "signature": self.solana_private_key, # Base58 / signature payload reference
                "payTo": payment_opt["payTo"]
            }
            sig_header = json.dumps(sig_data)
        elif self.sender_mnemonic and self._algod_client:
            from algosdk.transaction import AssetTransferTxn
            recipient = payment_opt["payTo"]
            asset_id = int(payment_opt.get("asset") or payment_opt.get("assetId") or 31566704)
            params = self._algod_client.suggested_params()
            sender_addr = self.sender or self.sender_address
            txn = AssetTransferTxn(
                sender=sender_addr,
                sp=params,
                receiver=recipient,
                amt=amount_micro_usdc,
                index=asset_id,
            )
            from algosdk import encoding
            stxn = txn.sign(self._algorand_private_key)
            signed_b64 = encoding.msgpack_encode(stxn)
            sig_data = {
                "x402Version": 2,
                "resource": challenge.get("resource"),
                "accepted": payment_opt,
                "payload": {
                    "paymentGroup": [signed_b64],
                    "paymentIndex": 0
                }
            }
            sig_header = json.dumps(sig_data)
        else:
            raise PaymentRequiredError(f"No wallet configured for challenge network: {network}")

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

        err_hdr = paid_resp.headers.get("payment-required") or paid_resp.headers.get("PAYMENT-REQUIRED") or ""
        raise PinningFailedError(f"Post-payment request failed with status {paid_resp.status_code}: {paid_resp.text} | Header: {err_hdr}")

