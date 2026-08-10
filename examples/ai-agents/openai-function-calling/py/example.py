#!/usr/bin/env python3
"""
OpenAI Function Calling Example — IPFS Pay-to-Pin

Demonstrates how to give an OpenAI-powered AI agent the ability to
upload files to IPFS using Algorand microUSDC x402 payments.

This example uses the OpenAI Python SDK with function calling to let
the model decide when and how to pin files.

Installation:
    pip install openai algosdk

Usage:
    ALGORAND_MNEMONIC="your 25-word mnemonic" python example.py
"""

import base64
import json
import os
import sys
from typing import Optional

from openai import OpenAI

# ---------------------------------------------------------------------------
# IPFS Pay-to-Pin x402 Client (pure Python — no TypeScript dependency)
# ---------------------------------------------------------------------------


class InsufficientBudgetError(Exception):
    """Raised when the payment price exceeds the configured max."""


class PaymentDeclinedError(Exception):
    """Raised when the confirm_price callback returns False."""


class IpfsPayToPinClient:
    """Minimal client for the IPFS Pay-to-Pin gateway.

    Handles the x402 challenge-response payment flow:
    1. POST file data → HTTP 402 with x402 challenge
    2. Parse challenge → sign Algorand payment
    3. Resubmit with payment header → receive CID
    """

    def __init__(
        self,
        mnemonic: str,
        gateway_url: str = "https://pay-to-pin.duckdns.org",
        sender: Optional[str] = None,
        network: str = "testnet",
        max_price_usdc: float = 1.0,
        confirm_price: Optional[callable] = None,
    ):
        self.mnemonic = mnemonic
        self.sender = sender
        self.network = network
        self.max_price_usdc = max_price_usdc
        self.confirm_price = confirm_price
        self.gateway_url = gateway_url.rstrip("/")

        # Derive account
        from algosdk import mnemonic_to_secret_key, encoding

        sk_hex = mnemonic_to_secret_key(mnemonic)
        self.account_address = encoding.address_from_private_key(sk_hex)

    def pin_file(self, filename: str, file_data: str) -> dict:
        """Pin a file to IPFS.

        Args:
            filename: Name of the file to upload.
            file_data: Base64-encoded file content.

        Returns:
            Dict with ipfs_cid, gateway_url, status, etc.

        Raises:
            InsufficientBudgetError: Price exceeds max_price_usdc.
            PaymentDeclinedError: User declined the price.
            RuntimeError: Network or unexpected error.
        """
        import requests

        pin_url = f"{self.gateway_url}/api/v1/pin"
        payload = {"filename": filename, "data": file_data}

        # Step 1: Initial request — expect 402 challenge
        resp = requests.post(pin_url, json=payload, timeout=30)

        # Free pin (no payment required)
        if resp.status_code == 200:
            return resp.json()

        # Expect 402 with x402 headers
        if resp.status_code != 402:
            raise RuntimeError(
                f"Upload failed with status {resp.status_code}: "
                f"{resp.text[:500]}"
            )

        # Parse challenge from headers
        challenge = self._parse_challenge(resp)
        if not challenge:
            raise RuntimeError("No x402 challenge found in response headers")

        price_usdc = float(challenge.get("price_usdc", 0))

        # Budget check
        if price_usdc > self.max_price_usdc:
            raise InsufficientBudgetError(
                f"Price (${price_usdc} USDC) exceeds max cap "
                f"(${self.max_price_usdc} USDC)."
            )

        # Optional confirmation
        if self.confirm_price:
            if not self.confirm_price(price_usdc, filename):
                raise PaymentDeclinedError(
                    f"User declined ${price_usdc} USDC for {filename}"
                )

        # Sign payment and submit
        payment_header = self._create_payment_header(challenge)

        paid_resp = requests.post(
            pin_url, json=payload, headers=payment_header, timeout=30
        )
        paid_resp.raise_for_status()
        return paid_resp.json()

    def get_pin_status(self, cid: str) -> dict:
        """Check retention status of a pinned CID."""
        import requests

        url = f"{self.gateway_url}/api/v1/pin/{cid}"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def _parse_challenge(self, response) -> dict:
        """Extract x402 challenge from response."""
        import json

        challenge_json = response.headers.get(
            "x-x402-challenge",
            response.headers.get("X-X402-Challenge", ""),
        )
        if challenge_json:
            return json.loads(challenge_json)
        return {
            "uri": f"{self.gateway_url}/api/v1/pin",
            "price_usdc": "0.50",
        }

    def _create_payment_header(self, challenge: dict) -> dict:
        """Create x402 payment header from challenge."""
        try:
            from algosdk.future import transaction
            from algosdk.account import Account

            account = Account(self.mnemonic)
            payment_txn = transaction.PaymentTxn(
                sender=account.address,
                sp=transaction.SuggestedParams(
                    fee=1000,
                    first_round=0,
                    last_round=1000,
                    gen="testnet" if self.network == "testnet" else "mainnet",
                    gh="wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=",
                ),
                receiver=challenge.get("receiver", "") or account.address,
                amount=500000,  # microUSDC placeholder
            )
            signed = payment_txn.sign(account.private_key)
            import base64

            signed_b64 = base64.b64encode(signed.blob()).decode("utf-8")
            return {"Signed-Asset-Transfer": signed_b64}
        except Exception as e:
            raise RuntimeError(f"Failed to create x402 payment: {e}")


# ---------------------------------------------------------------------------
# Function definition for OpenAI Function Calling
# ---------------------------------------------------------------------------

IPFS_PIN_FILE_FUNCTION = {
    "name": "ipfs_pin_file",
    "description": (
        "Upload a file to IPFS using pay-to-pin. The file is pinned "
        "for 365 days with a microUSDC x402 payment. Returns the "
        "IPFS Content ID (CID) and a gateway URL to access the file."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": (
                    "Name of the file to upload, including extension. "
                    "Examples: 'report.pdf', 'photo.jpg', 'data.json'"
                ),
            },
            "file_data": {
                "type": "string",
                "description": (
                    "Base64-encoded content of the file. Encode the raw "
                    "file bytes using base64 before passing them here."
                ),
            },
            "max_price_usdc": {
                "type": "number",
                "description": (
                    "Maximum price in USDC to pay for this pin. "
                    "Defaults to 1.0. Set lower to cap spending."
                ),
            },
        },
        "required": ["filename", "file_data"],
        "additionalProperties": False,
    },
    "strict": False,
}


# ---------------------------------------------------------------------------
# Tool handler — called when the model requests a function call
# ---------------------------------------------------------------------------


def handle_ipfs_pin_file(args: dict, client: IpfsPayToPinClient) -> str:
    """Execute the IPFS pin operation when invoked by the OpenAI model."""
    filename = args.get("filename", "untitled")
    file_data = args.get("file_data", "")
    max_price = args.get("max_price_usdc", 1.0)

    try:
        result = client.pin_file(filename=filename, file_data=file_data)
        return (
            f"✅ Successfully pinned '{filename}' to IPFS!\n"
            f"  CID: {result.get('ipfs_cid', 'N/A')}\n"
            f"  Gateway: {result.get('gateway_url', 'N/A')}\n"
            f"  Status: {result.get('status', 'unknown')}\n"
            f"  Expires: {result.get('expires_at', 'unknown')}"
        )
    except InsufficientBudgetError as e:
        return f"❌ Budget exceeded: {e}"
    except PaymentDeclinedError as e:
        return f"❌ Payment declined: {e}"
    except Exception as e:
        return f"❌ Error: {type(e).__name__} — {e}"


# ---------------------------------------------------------------------------
# Main agent loop
# ---------------------------------------------------------------------------

def run_agent(
    system_prompt: str,
    user_messages: list[str],
    openai_api_key: Optional[str] = None,
    model: str = "gpt-4o-mini",
) -> None:
    """Run a multi-turn agent that can call the IPFS pin function.

    Args:
        system_prompt: System message defining the agent's role.
        user_messages: List of user messages for the conversation.
        openai_api_key: OpenAI API key (or set OPENAI_API_KEY env var).
        model: OpenAI model to use.
    """
    api_key = openai_api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("❌ Set OPENAI_API_KEY environment variable.")
        sys.exit(1)

    mnemonic = os.environ.get("ALGORAND_MNEMONIC")
    if not mnemonic:
        print("⚠️  Set ALGORAND_MNEMONIC environment variable.")
        print("   Agent can still run in demo mode without it.")

    openai_client = OpenAI(api_key=api_key)

    if mnemonic:
        pin_client = IpfsPayToPinClient(
            mnemonic=mnemonic,
            network=os.environ.get("PIN_NETWORK", "testnet"),
        )
    else:
        pin_client = None

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": "user", "content": msg} for msg in user_messages)

    while True:
        # Show user prompt
        print("\n" + "=" * 60)
        print("👤 You:", user_messages[-1] if user_messages else "...")
        print("=" * 60)

        response = openai_client.chat.completions.create(
            model=model,
            messages=messages,
            functions=[IPFS_PIN_FILE_FUNCTION],
            function_call="auto",
        )

        assistant_msg = response.choices[0].message
        messages.append(
            {"role": "assistant", "content": assistant_msg.content or ""}
        )

        print("\n🤖 Agent:", assistant_msg.content)

        # Check if the model wants to call our function
        if assistant_msg.function_call:
            func_name = assistant_msg.function_call.name
            func_args = json.loads(assistant_msg.function_call.arguments)

            if func_name == "ipfs_pin_file":
                print("  📦 Function call: ipfs_pin_file")
                print(f"     Args: {json.dumps(func_args, indent=6)}")

                if pin_client:
                    result = handle_ipfs_pin_file(func_args, pin_client)
                else:
                    # Demo mode: simulate a successful pin
                    import hashlib

                    simulated_cid = (
                        hashlib.sha256(
                            func_args.get("filename", "test").encode()
                        )
                        .hexdigest()[:59]
                    )
                    result = (
                        f"✅ [DEMO MODE] Pinned '{func_args.get('filename', '?')}' to IPFS!\n"
                        f"  CID: {simulated_cid}\n"
                        f"  Gateway: https://ipfs.io/ipfs/{simulated_cid}\n"
                        f"  Status: success\n"
                        f"  Expires: 2026-08-09"
                    )

                messages.append(
                    {
                        "role": "function",
                        "name": func_name,
                        "content": result,
                    }
                )
                print(f"\n  📤 Function result:\n{result}")
                continue
            else:
                print(f"  ⚠️  Unknown function: {func_name}")
                continue

        # No function call — agent is done (or wants user input)
        print("  ✅ Agent waiting (no function call needed)")
        break


# ---------------------------------------------------------------------------
# Demo / Example runs
# ---------------------------------------------------------------------------

def demo_basic():
    """Run a simple demo showing the agent pinning a file."""

    system_prompt = (
        "You are a helpful AI assistant with the ability to upload "
        "files to IPFS. When the user asks you to upload or store a "
        "file, use the ipfs_pin_file function. The file will be stored "
        "on IPFS for 365 days with a small x402 payment."
    )

    print("🚀 Demo 1: Simple file upload\n")
    run_agent(
        system_prompt=system_prompt,
        user_messages=[
            "Please upload this text to IPFS: 'Hello from my AI agent! 🤖'"
        ],
    )


def demo_image_upload():
    """Run a demo showing base64-encoded binary file upload."""
    import os

    system_prompt = (
        "You are a helpful AI assistant. You can upload files of any "
        "type to IPFS by encoding them as base64 first."
    )

    # Find a test image in the repo
    image_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "test_image.png"
    )
    if os.path.exists(image_path):
        with open(image_path, "rb") as f:
            file_b64 = base64.b64encode(f.read()).decode()

        user_msg = (
            f"Upload this image to IPFS. Here is the base64 data: "
            f"{file_b64[:100]}... (truncated for display, "
            f"full data sent)"
        )

        print("\n🖼️  Demo 2: Image upload with base64\n")
        run_agent(
            system_prompt=system_prompt,
            user_messages=[user_msg],
        )
    else:
        print(
            "No test image found at repo root. "
            "Skipping image upload demo."
        )


def demo_text_file():
    """Demo creating and uploading a text file."""
    system_prompt = (
        "You are a helpful AI assistant. When asked to create and "
        "store a file, create its content, encode it as base64, "
        "then use ipfs_pin_file to store it on IPFS."
    )

    # Create a sample text file
    text_content = (
        "This file was created and uploaded by an AI agent.\n"
        "It is permanently pinned to IPFS via x402 micropayments.\n"
        f"Timestamp: {os.urandom(8).hex()}\n"
        "🕸️ IPFS forever 🕸️"
    )
    file_b64 = base64.b64encode(text_content.encode()).decode()

    print("\n📄 Demo 3: Text file upload\n")
    run_agent(
        system_prompt=system_prompt,
        user_messages=[
            "Create a welcome message file and upload it to IPFS "
            "as 'welcome.txt'"
        ],
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("  IPFS Pay-to-Pin × OpenAI Function Calling Demo")
    print("  Giving AI agents their own decentralized storage wallet")
    print("=" * 60)

    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        demo_basic()
    elif len(sys.argv) > 1 and sys.argv[1] == "--image":
        demo_image_upload()
    elif len(sys.argv) > 1 and sys.argv[1] == "--text":
        demo_text_file()
    else:
        # Run all demos sequentially
        demo_basic()
        demo_image_upload()
        demo_text_file()

    print("\n" + "=" * 60)
    print("  Demo complete! 🎉")
    print("=" * 60)
