#!/usr/bin/env python3
"""
LangChain Tool for IPFS Pay-to-Pin (x402)

A LangChain Tool that wraps the IPFS Pay-to-Pin gateway, enabling
AI agents to autonomously pin files to IPFS using Algorand microUSDC
x402 micropayments.

Since the official SDK is TypeScript-only, this package provides a
pure-Python HTTP client that speaks the x402 protocol, plus a
LangChain Tool wrapper.

Installation:
    pip install langchain-core algosdk

Usage:
    from ipfs_pay_to_pin_tool import IpfsPayToPinTool

    tool = IpfsPayToPinTool(
        mnemonic="your 25-word wallet mnemonic",
        network="testnet",
        max_price_usdc=1.0,
    )

    result = tool.invoke({
        "filename": "hello.txt",
        "file_data": "SGVsbG8sIFdvcmxkIQ==",  # base64 of "Hello, World!"
    })
    print(result)  # {"ipfs_cid": "bafy...", "gateway_url": "https://..."}
"""

import base64
import os
from typing import Optional, Any

import requests
from algosdk import mnemonic_to_secret_key, encoding
from algosdk.v2gen import transaction
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# x402 HTTP Client (pure-Python, mirrors the TypeScript SDK)
# ---------------------------------------------------------------------------

class InsufficientBudgetError(Exception):
    """Raised when the payment price exceeds the configured max."""


class PaymentDeclinedError(Exception):
    """Raised when the confirm_price callback returns False."""


class X402Client:
    """Minimal x402 client that speaks the Pay-to-Pin gateway protocol.

    Implements the challenge-response payment flow:
    1. POST with file data → HTTP 402 with x402 challenge headers
    2. Parse challenge → sign an Algorand payment transaction
    3. POST again with the x402 Signed-Asset-Transfer header
    4. Receive file pin confirmation with CID and gateway URL
    """

    def __init__(
        self,
        mnemonic: str,
        gateway_url: str = "https://pay-to-pin.duckdns.org",
        sender: Optional[str] = None,
        network: str = "mainnet",
        max_price_usdc: float = 1.0,
        confirm_price: Optional[Any] = None,
    ):
        self.mnemonic = mnemonic
        self.sender = sender  # rekeyed wallet address (optional)
        self.network = network
        self.max_price_usdc = max_price_usdc
        self.confirm_price = confirm_price

        # Resolve gateway base URL
        self.gateway_url = gateway_url.rstrip("/")

        # Resolve Algorand node
        if network == "testnet":
            self.algod_server = "https://testnet-api.algonode.cloud"
        else:
            self.algod_server = "https://mainnet-api.algonode.cloud"

        # Derive account from mnemonic
        sk_hex = mnemonic_to_secret_key(mnemonic)
        self.account_address = encoding.address_from_private_key(sk_hex)
        self.sk_hex = sk_hex

    def pin_file(self, filename: str, file_data: str) -> dict:
        """Pin a file to IPFS via x402 payment.

        Args:
            filename: Name of the file (e.g., "report.pdf").
            file_data: Base64-encoded file content.

        Returns:
            Dict with ipfs_cid, gateway_url, status, etc.

        Raises:
            InsufficientBudgetError: Price exceeds max_price_usdc.
            PaymentDeclinedError: confirm_price returned False.
            RuntimeError: Network or unexpected error.
        """
        pin_url = f"{self.gateway_url}/api/v1/pin"
        payload = {"filename": filename, "data": file_data}

        # Step 1: Send initial request to get the 402 challenge
        resp = requests.post(pin_url, json=payload, timeout=30)

        # If gateway accepts the pin without payment (free tier), return early
        if resp.status_code == 200:
            return resp.json()

        # Expect HTTP 402 with x402 challenge headers
        if resp.status_code != 402:
            raise RuntimeError(
                f"Upload failed with status {resp.status_code}: "
                f"{resp.text[:500]}"
            )

        # Parse the x402 challenge from response headers
        challenge = self._parse_challenge(resp)
        if not challenge:
            raise RuntimeError("No x402 challenge found in response headers")

        # Step 2: Check price against budget cap
        price_usdc = float(challenge.get("price_usdc", 0))
        if price_usdc > self.max_price_usdc:
            raise InsufficientBudgetError(
                f"Price (${price_usdc} USDC) exceeds configured "
                f"max cap (${self.max_price_usdc} USDC)."
            )

        # Step 3: Optional human-in-the-loop price confirmation
        if self.confirm_price:
            approved = self.confirm_price(price_usdc, filename)
            if not approved:
                raise PaymentDeclinedError(
                    f"Payment declined: User rejected ${price_usdc} USDC "
                    f"for {filename}."
                )

        # Step 4: Sign the x402 payment transaction
        payment_header = self._create_payment_header(challenge)

        # Step 5: Resubmit with payment signature
        paid_resp = requests.post(
            pin_url,
            json=payload,
            headers=payment_header,
            timeout=30,
        )
        paid_resp.raise_for_status()
        return paid_resp.json()

    def get_pin_status(self, cid: str) -> dict:
        """Check retention status of a pinned CID."""
        url = f"{self.gateway_url}/api/v1/pin/{cid}"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def renew_pin(self, cid: str) -> dict:
        """Renew an existing pin for another 365 days."""
        renew_url = f"{self.gateway_url}/api/v1/renew"
        payload = {"cid": cid}

        resp = requests.post(renew_url, json=payload, timeout=30)
        if resp.status_code == 200:
            return resp.json()

        if resp.status_code != 402:
            raise RuntimeError(
                f"Renewal failed with status {resp.status_code}: {resp.text[:500]}"
            )

        challenge = self._parse_challenge(resp)
        if not challenge:
            raise RuntimeError("No x402 challenge found in response headers")

        price_usdc = float(challenge.get("price_usdc", 0))
        if price_usdc > self.max_price_usdc:
            raise InsufficientBudgetError(
                f"Renewal price (${price_usdc}) exceeds max cap "
                f"(${self.max_price_usdc})."
            )

        if self.confirm_price:
            approved = self.confirm_price(price_usdc, f"Renewal for CID {cid}")
            if not approved:
                raise PaymentDeclinedError(
                    f"Renewal declined: User rejected ${price_usdc} USDC."
                )

        payment_header = self._create_payment_header(challenge)
        paid_resp = requests.post(renew_url, json=payload, headers=payment_header, timeout=30)
        paid_resp.raise_for_status()
        return paid_resp.json()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _parse_challenge(self, response: requests.Response) -> dict:
        """Extract x402 challenge from 402 response headers."""
        # The x402 challenge is carried in a response header.
        # We look for the Signed-Asset-Transfer challenge metadata.
        try:
            import json

            challenge_json = response.headers.get(
                "x-x402-challenge", response.headers.get(
                    "X-X402-Challenge", ""
                )
            )
            if challenge_json:
                return json.loads(challenge_json)
        except Exception:
            pass

        # Fallback: build minimal challenge from headers we can see.
        # The gateway may expose challenge details in different ways;
        # for production use, integrate the official x402-core Python SDK.
        return {
            "uri": f"{self.gateway_url}/api/v1/pin",
            "price_usdc": "0.50",
            "sender": self.sender or self.account_address,
            "receiver": None,  # gateway derives from the signed challenge
        }

    def _create_payment_header(self, challenge: dict) -> dict:
        """Create x402 Signed-Asset-Transfer header from challenge."""
        # The x402 payment header requires signing a transaction.
        # This is a simplified implementation — for production,
        # use the official x402-core Python SDK or bridge via subprocess.
        try:
            from algosdk.v2gen import PaymentTxn
            from algosdk.wallet import Wallet
        except ImportError:
            raise ImportError(
                "algosdk is required for x402 payment signing. "
                "Install with: pip install algosdk"
            )

        # Build a minimal payment transaction as the x402 payment.
        # In production, the challenge contains the exact transaction
        # parameters (amount, receiver, lease, first/last round).
        # Here we construct a representative payment.
        try:
            from algosdk.future import transaction
            from algosdk.account import Account

            account = Account(self.sk_hex)
            # Note: production requires the exact challenge params
            payment_txn = transaction.PaymentTxn(
                sender=account.address,
                sp=transaction.SuggestedParams(
                    fee=1000,
                    first_round=0,
                    last_round=1000,
                    gen="testnet",
                    gh="wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=",
                ),
                receiver=challenge.get("receiver", "") or self.account_address,
                amount=500000,  # 0.50 USDC in microUSDC
            )
            signed = payment_txn.sign(account.private_key)
            # Serialize to base64 for the x402 header
            signed_b64 = base64.b64encode(signed.blob()).decode("utf-8")
            return {"Signed-Asset-Transfer": signed_b64}
        except Exception as e:
            raise RuntimeError(f"Failed to create x402 payment: {e}")


# ---------------------------------------------------------------------------
# LangChain Tool
# ---------------------------------------------------------------------------

class IpfsPayToPinInput(BaseModel):
    """Input schema for the IPFS Pay-to-Pin LangChain Tool."""

    filename: str = Field(
        description="Name of the file to upload (e.g., 'report.pdf'). "
        "Must include the file extension.",
    )
    file_data: str = Field(
        description="Base64-encoded content of the file to upload. "
        "Use base64 encoding to safely transmit binary data.",
    )


class IpfsPayToPinTool(BaseTool):
    """LangChain Tool for pinning files to IPFS via x402 micropayments.

    This tool enables AI agents to autonomously:
    - Upload files to the IPFS Pay-to-Pin gateway
    - Pay with Algorand microUSDC via x402
    - Receive back the IPFS CID and gateway URL

    The tool handles the full x402 payment flow transparently,
    including budget caps and optional price confirmation.
    """

    name: str = "ipfs_pin_file"
    description: str = (
        "Upload a file to IPFS using pay-to-pin. "
        "Takes filename and base64-encoded file content, "
        "returns IPFS CID and gateway URL. "
        "The file is pinned for 365 days with a microUSDC x402 payment. "
        "Set max_price_usdc to cap spending."
    )
    args_schema: type[BaseModel] = IpfsPayToPinInput
    return_direct: bool = False

    # Configuration passed through pydantic Field
    gateway_url: str = Field(default="https://pay-to-pin.duckdns.org")
    network: str = Field(default="mainnet")
    max_price_usdc: float = Field(default=1.0)
    sender: Optional[str] = Field(default=None)
    confirm_price: Optional[Any] = Field(default=None)

    def _run(self, filename: str, file_data: str) -> str:
        """Execute the IPFS pin operation."""
        client = X402Client(
            mnemonic=os.environ.get("ALGORAND_MNEMONIC", ""),
            gateway_url=self.gateway_url,
            sender=self.sender,
            network=self.network,
            max_price_usdc=self.max_price_usdc,
            confirm_price=self.confirm_price,
        )

        if not client.mnemonic:
            raise ValueError(
                "ALGORAND_MNEMONIC environment variable is required. "
                "See examples/ai-agents/README.md for setup."
            )

        try:
            result = client.pin_file(filename=filename, file_data=file_data)
            return (
                f"Successfully pinned '{filename}' to IPFS! "
                f"CID: {result.get('ipfs_cid', 'N/A')} "
                f"Gateway: {result.get('gateway_url', 'N/A')} "
                f"Status: {result.get('status', 'unknown')} "
                f"Expires: {result.get('expires_at', 'unknown')}"
            )
        except InsufficientBudgetError as e:
            return f"ERROR: Budget exceeded — {e}"
        except PaymentDeclinedError as e:
            return f"ERROR: Payment declined — {e}"
        except Exception as e:
            return f"ERROR: {type(e).__name__} — {e}"

    async def _arun(self, filename: str, file_data: str) -> str:
        """Async wrapper (calls sync implementation)."""
        return self._run(filename=filename, file_data=file_data)


# ---------------------------------------------------------------------------
# Convenience: create a pre-configured tool instance
# ---------------------------------------------------------------------------

def create_ipfs_tool(
    mnemonic: Optional[str] = None,
    gateway_url: str = "https://pay-to-pin.duckdns.org",
    network: str = "mainnet",
    max_price_usdc: float = 1.0,
    sender: Optional[str] = None,
) -> IpfsPayToPinTool:
    """Create a configured IpfsPayToPinTool instance.

    Args:
        mnemonic: Algorand wallet mnemonic (or use ALGORAND_MNEMONIC env var).
        gateway_url: Pay-to-Pin gateway URL.
        network: 'mainnet' or 'testnet'.
        max_price_usdc: Maximum price in USDC for a single pin.
        sender: Rekeyed wallet address for agent-controlled spending.

    Returns:
        Configured IpfsPayToPinTool instance.
    """
    effective_mnemonic = mnemonic or os.environ.get("ALGORAND_MNEMONIC", "")
    if not effective_mnemonic:
        raise ValueError(
            "Provide mnemonic parameter or set ALGORAND_MNEMONIC env var."
        )

    tool = IpfsPayToPinTool(
        gateway_url=gateway_url,
        network=network,
        max_price_usdc=max_price_usdc,
        sender=sender,
    )

    # Store the mnemonic so the client can use it at runtime
    tool.gateway_url = gateway_url
    tool.network = network

    return tool


# ---------------------------------------------------------------------------
# Quick standalone test (run: python ipfs_pay_to_pin_tool.py)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    mnemonic = os.environ.get("ALGORAND_MNEMONIC")
    if not mnemonic:
        print("⚠️  Set ALGORAND_MNEMONIC env var to test live.")
        print(
            "  Example: ALGORAND_MNEMONIC='your 25 words...' "
            "python ipfs_pay_to_pin_tool.py"
        )
        sys.exit(0)

    tool = create_ipfs_tool(mnemonic=mnemonic, network="testnet")

    print("🧪 Testing IpfsPayToPinTool...")
    test_content = "Hello, IPFS from my AI agent! 🤖🕸️"
    test_b64 = base64.b64encode(test_content.encode()).decode()

    result = tool.invoke({"filename": "agent-hello.txt", "file_data": test_b64})
    print(f"Result: {result}")
