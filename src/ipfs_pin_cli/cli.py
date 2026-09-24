#!/usr/bin/env python3
"""
ipfs-pin CLI — Command-line interface for IPFS Pin & Unpin via Pay-to-Pin service.

Wraps the ipfs-pay-to-pin Python SDK with convenient terminal commands for operators,
developers, and agents.

Usage examples:
    ipfs-pin pin my-image.png                  # Pin a local file
    ipfs-pin pin-url https://example.com/img   # Pin from URL
    ipfs-pin status bafybeigdyrzt...          # Check pin status
    ipfs-pin renew bafybeigdyrzt...            # Renew pin for 365 days
    ipfs-pin unpin bafybeigdyrzt...            # Unpin (delete from IPFS)
    ipfs-pin list                               # List all pins
    ipfs-pin config set gateway https://...    # Configure gateway URL
    ipfs-pin config set mnemonic <mnemonic>    # Set wallet mnemonic
"""

import base64
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    import click
except ImportError:
    click = None

try:
    import keyring
    HAS_KEYRING = True
except ImportError:
    HAS_KEYRING = False

try:
    import requests
except ImportError:
    requests = None

# ---------------------------------------------------------------------------
# Config management — ~/.config/ipfs-pin/config.json + keyring
# ---------------------------------------------------------------------------

CONFIG_DIR = Path.home() / ".config" / "ipfs-pin"
CONFIG_FILE = CONFIG_DIR / "config.json"


def _load_config() -> dict:
    """Load CLI config from JSON file, creating the directory if needed."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        try:
            import json
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def _save_config(cfg: dict) -> None:
    """Persist CLI config to JSON file."""
    import json
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)


def _get_config(key: str, default: str | None = None) -> str | None:
    cfg = _load_config()
    return cfg.get(key, default)


def _set_config(key: str, value: str) -> None:
    cfg = _load_config()
    cfg[key] = value
    _save_config(cfg)


def _store_secret(label: str, secret: str) -> bool:
    """Store a secret (e.g. mnemonic) in OS keyring if available."""
    if not HAS_KEYRING:
        return False
    try:
        keyring.set_password("ipfs-pin", label, secret)
        return True
    except Exception:
        return False


def _retrieve_secret(label: str) -> Optional[str]:
    """Retrieve a secret from OS keyring if available."""
    if not HAS_KEYRING:
        return None
    try:
        return keyring.get_password("ipfs-pin", label)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Color helpers — works in terminals, degrades gracefully
# ---------------------------------------------------------------------------

class _Colors:
    """ANSI color codes with terminal detection."""

    _enabled: bool = False

    @classmethod
    def init(cls, force: bool = False) -> None:
        cls._enabled = force or sys.stderr.isatty()
        # Allow env var override for testing
        if os.environ.get("FORCE_COLORS") == "1":
            cls._enabled = True

    @classmethod
    def success(cls, text: str) -> str:
        return cls._fmt("\x1b[32m", text, "\x1b[0m") if cls._enabled else text

    @classmethod
    def error(cls, text: str) -> str:
        return cls._fmt("\x1b[31m", text, "\x1b[0m") if cls._enabled else text

    @classmethod
    def warning(cls, text: str) -> str:
        return cls._fmt("\x1b[33m", text, "\x1b[0m") if cls._enabled else text

    @classmethod
    def info(cls, text: str) -> str:
        return cls._fmt("\x1b[36m", text, "\x1b[0m") if cls._enabled else text

    @classmethod
    def muted(cls, text: str) -> str:
        return cls._fmt("\x1b[90m", text, "\x1b[0m") if cls._enabled else text

    @staticmethod
    def _fmt(fg: str, text: str, reset: str) -> str:
        return f"{fg}{text}{reset}"


# ---------------------------------------------------------------------------
# Client helper — resolves SDK client with config
# ---------------------------------------------------------------------------

def _resolve_client(
    gateway: Optional[str] = None,
    mnemonic: Optional[str] = None,
    evm_pk: Optional[str] = None,
    solana_pk: Optional[str] = None,
) -> "IpfsPayToPinClient | None":
    """Build an IpfsPayToPinClient from CLI args and config.

    Priority: explicit CLI args > config file > keyring.
    Returns None if no wallet config is available.
    """
    if requests is None:
        click.echo(
            click.style("Error: 'requests' package not installed. Install with: pip install requests", fg="red"),
            err=True,
        )
        return None

    try:
        from ipfs_pay_to_pin_client import IpfsPayToPinClient
    except ImportError:
        click.echo(
            click.style(
                "Error: 'ipfs-pay-to-pin-client' package not installed. "
                "Install with: pip install ipfs-pay-to-pin-client",
                fg="red",
            ),
            err=True,
        )
        return None

    gw = gateway or os.environ.get("IPFS_PIN_GATEWAY_URL") or _get_config("gateway")
    mn = mnemonic or _get_config("mnemonic") or _retrieve_secret("mnemonic")
    evm = evm_pk or _get_config("evm_private_key") or _retrieve_secret("evm_private_key")
    sol = solana_pk or _get_config("solana_private_key") or _retrieve_secret("solana_private_key")

    if not any([mn, evm, sol]):
        click.echo(
            click.style(
                "Error: No wallet configured. Set one with:\n"
                "  ipfs-pin config set mnemonic <mnemonic>  (Algorand)\n"
                "  ipfs-pin config set evm <key>            (EVM)\n"
                "  ipfs-pin config set solana <key>         (Solana)\n"
                "Or pass --mnemonic, --evm, --solana flags.",
                fg="red",
            ),
            err=True,
        )
        return None

    return IpfsPayToPinClient(
        gateway_url=gw or "https://pay-to-pin.duckdns.org",
        sender_mnemonic=mn,
        evm_private_key=evm,
        solana_private_key=sol,
    )


def _print_success(cid: str, status: str, expires: str, tx_id: Optional[str] = None) -> None:
    """Print a successful pin result in colored format."""
    click.echo(click.style("✅ Pin successful!", fg="green"))
    click.echo(click.style(f"   CID:     {cid}", fg="cyan"))
    click.echo(click.style(f"   Status:  {status}", fg="cyan"))
    if expires:
        click.echo(click.style(f"   Expires: {expires}", fg="cyan"))
    if tx_id:
        click.echo(click.style(f"   TX ID:   {tx_id}", fg="cyan"))


def _print_error(msg: str) -> None:
    """Print an error message."""
    click.echo(click.style(f"❌ {msg}", fg="red"), err=True)


# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------

@click.group()
@click.option("--gateway", default=None, help="Gateway URL (overrides config & env)")
@click.option("--mnemonic", default=None, hidden=True, help="[INTERNAL] Algorand mnemonic")
@click.option("--evm", default=None, hidden=True, help="[INTERNAL] EVM private key")
@click.option("--solana", default=None, hidden=True, help="[INTERNAL] Solana private key")
@click.option("--yes", "-y", "assume_yes", is_flag=True, default=False, help="Skip confirmation prompts")
@click.version_option(version="0.1.0", prog_name="ipfs-pin")
@click.pass_context
def cli(ctx, gateway, mnemonic, evm, solana, assume_yes):
    """ipfs-pin — Pin, unpin, and manage IPFS content via Pay-to-Pin.

    A command-line tool for pinning files to IPFS, checking status, and renewing
    retention. Supports Algorand, EVM, and Solana wallet-based payments.
    """
    _Colors.init()
    ctx.ensure_object(dict)
    ctx.obj["gateway"] = gateway
    ctx.obj["mnemonic"] = mnemonic
    ctx.obj["evm_pk"] = evm  # Matches _resolve_client parameter name
    ctx.obj["solana_pk"] = solana  # Matches _resolve_client parameter name
    ctx.obj["assume_yes"] = assume_yes


@cli.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--filename", default=None, help="Custom filename for the pin record")
@click.option("--max-price", default=None, type=float, help="Maximum USDC price to accept")
@click.option("--yes", "-y", "assume_yes", is_flag=True, default=False, hidden=True, help="Skip confirmation prompts")
@click.pass_context
def pin(ctx, file_path, filename, max_price, assume_yes):
    """Pin a local file to IPFS."""
    client = _resolve_client(**ctx.obj)
    if client is None:
        return click.get_current_context().fail("Cannot create client — configure a wallet first.")

    fp = Path(file_path).resolve()
    fname = filename or fp.name

    click.echo(click.style(f"📦 Pinning {fp}...", fg="cyan"))

    try:
        resp = client.pin_file(str(fp), max_price_usdc=max_price)
        _print_success(
            cid=resp.cid,
            status=resp.status,
            expires=resp.pin_expires_at,
            tx_id=resp.tx_id,
        )
    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument("url")
@click.argument("filename", default=None, required=False)
@click.option("--max-price", default=None, type=float, help="Maximum USDC price to accept")
@click.option("--yes", "-y", "assume_yes", is_flag=True, default=False, hidden=True, help="Skip confirmation prompts")
@click.pass_context
def pin_url(ctx, url, filename, max_price, assume_yes):
    """Pin a file from a URL."""
    client = _resolve_client(**ctx.obj)
    if client is None:
        return click.get_current_context().fail("Cannot create client — configure a wallet first.")

    fname = filename or Path(url).name or "downloaded_file"
    click.echo(click.style(f"📥 Downloading {url}...", fg="cyan"))

    try:
        import requests as req
        resp = req.get(url, timeout=30)
        resp.raise_for_status()
        click.echo(click.style(f"  Downloaded {len(resp.content)} bytes", fg="cyan"))
    except Exception as e:
        _print_error(f"Download failed: {e}")
        sys.exit(1)

    try:
        pin_resp = client.pin_bytes(resp.content, filename=fname, max_price_usdc=max_price)
        _print_success(
            cid=pin_resp.cid,
            status=pin_resp.status,
            expires=pin_resp.pin_expires_at,
            tx_id=pin_resp.tx_id,
        )
    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@cli.command("status")
@click.argument("cid")
@click.pass_context
def cmd_status(ctx, cid):
    """Check pin status for a CID."""
    client = _resolve_client(**ctx.obj)
    if client is None:
        return click.get_current_context().fail("Cannot create client — configure a wallet first.")

    click.echo(click.style(f"🔍 Checking status for {cid}...", fg="cyan"))

    try:
        result = client.get_status(cid)
        click.echo("")
        for key, value in result.items():
            click.echo(f"   {key}: {value}")
        click.echo("")
        status = result.get("status", "unknown")
        if status in ("pinned", "confirmed"):
            click.echo(click.style(f"✅ {status}", fg="green"))
        elif status == "unpinned":
            click.echo(click.style(f"⚠️  {status}", fg="yellow"))
        else:
            click.echo(click.style(f"• {status}", fg="grey"))
    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument("cid")
@click.option("--max-price", default=None, type=float, help="Maximum USDC price to accept for renewal")
@click.option("--yes", "-y", "assume_yes", is_flag=True, default=False, help="Skip confirmation prompts")
@click.pass_context
def renew(ctx, cid, max_price, assume_yes):
    """Renew pin retention for 365 days."""
    client = _resolve_client(**ctx.obj)
    if client is None:
        return click.get_current_context().fail("Cannot create client — configure a wallet first.")

    assume_yes = assume_yes or ctx.obj.get("assume_yes", False)
    if not assume_yes:
        if not click.confirm(click.style(f"Renew pin for {cid}?", fg="yellow")):
            click.echo("Aborted.")
            return

    click.echo(click.style(f"🔄 Renewing pin for {cid}...", fg="cyan"))

    try:
        resp = client.renew_pin(cid, max_price_usdc=max_price)
        _print_success(
            cid=resp.cid,
            status=resp.status,
            expires=resp.pin_expires_at,
            tx_id=resp.tx_id,
        )
    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument("cid")
@click.option("--yes", "-y", "assume_yes", is_flag=True, default=False, help="Skip confirmation prompts")
@click.pass_context
def unpin(ctx, cid, assume_yes):
    """Unpin (delete) a CID from IPFS."""
    client = _resolve_client(**ctx.obj)
    if client is None:
        return click.get_current_context().fail("Cannot create client — configure a wallet first.")

    assume_yes = assume_yes or ctx.obj.get("assume_yes", False)
    if not assume_yes:
        if not click.confirm(click.style(f"Unpin {cid}? This is IRREVERSIBLE.", fg="red")):
            click.echo("Aborted.")
            return

    click.echo(click.style(f"🗑️  Unpinning {cid}...", fg="cyan"))

    # The SDK client doesn't have a direct unpin method — we use the API endpoint
    # directly via the gateway. Check if the client exposes gateway_url.
    try:
        import requests as req
        url = f"{client.gateway_url}/api/v1/pin/{cid}"
        resp = req.delete(url)
        if resp.status_code in (200, 204):
            click.echo(click.style(f"✅ Unpinned {cid}", fg="green"))
        else:
            _print_error(f"Unpin failed ({resp.status_code}): {resp.text}")
            sys.exit(1)
    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@cli.command("list")
@click.pass_context
def list_pins(ctx):
    """List all pins with status (via Supabase)."""
    client = _resolve_client(**ctx.obj)
    if client is None:
        return click.get_current_context().fail("Cannot create client — configure a wallet first.")

    click.echo(click.style("📋 Listing pins...", fg="cyan"))

    # List pins via Supabase API — we call the gateway's list endpoint
    try:
        import requests as req
        url = f"{client.gateway_url}/api/v1/pins"
        resp = req.get(url)
        if resp.status_code == 200:
            pins = resp.json()
            if isinstance(pins, list) and pins:
                click.echo("")
                for pin in pins:
                    cid = pin.get("cid", "unknown")
                    status = pin.get("status", "?")
                    created = pin.get("created_at", "")
                    click.echo(f"  {click.style(cid, fg='grey')}")
                    click.echo(f"    status: {click.style(status, fg='green') if status == 'pinned' else status}")
                    if created:
                        click.echo(f"    created: {created}")
                    click.echo("")
            else:
                click.echo(click.style("No pins found.", fg="grey"))
        elif resp.status_code == 404:
            click.echo(click.style("No pins endpoint available. Try connecting to a gateway with Supabase.", fg="grey"))
        else:
            _print_error(f"Failed to list pins ({resp.status_code}): {resp.text}")
            sys.exit(1)
    except Exception as e:
        _print_error(str(e))
        sys.exit(1)


@cli.group()
def config():
    """Configure CLI settings (gateway, wallet keys)."""
    pass


@config.command("set")
@click.argument("key")
@click.argument("value")
@click.pass_context
def config_set(ctx, key, value):
    """Set a config value."""
    valid_keys = ["gateway", "mnemonic", "evm", "solana", "evm_private_key", "solana_private_key"]

    # Normalize aliases
    key_map = {
        "evm": "evm_private_key",
        "solana": "solana_private_key",
    }
    key = key_map.get(key.lower(), key.lower())

    if key not in ("gateway", "mnemonic", "evm_private_key", "solana_private_key"):
        click.echo(click.style(f"Unknown key: {key}. Valid: gateway, mnemonic, evm, solana", fg="red"))
        return

    value = value.strip()

    # Validate inputs
    if key == "gateway":
        if not value.startswith(("http://", "https://")):
            click.echo(click.style("Gateway URL must start with http:// or https://", fg="red"))
            return

    if key in ("mnemonic", "evm_private_key", "solana_private_key"):
        if value:
            is_secret = key != "gateway"
            # Check if keyring is available
            has_keyring = HAS_KEYRING

            if is_secret:
                if has_keyring:
                    stored = _store_secret(key, value)
                    if stored:
                        _set_config(key, "[STORED_IN_KEYRING]")
                        click.echo(click.style(f"✅ {key} stored securely in OS keyring", fg="green"))
                    else:
                        click.echo(click.style("⚠️  Keyring unavailable, storing in plaintext config (INSECURE)", fg="yellow"))
                        _set_config(key, value)
                else:
                    click.echo(click.style("⚠️  keyring package not installed. Storing in plaintext config.", fg="yellow"))
                    click.echo(click.style("    Install with: pip install keyring", fg="darkgrey"))
                    _set_config(key, value)
            else:
                _set_config(key, value)
                click.echo(click.style(f"✅ Configured: {key}", fg="green"))

            # Security warning for plaintext storage
            if not has_keyring or _get_config(key) != "[STORED_IN_KEYRING]":
                click.echo(click.style(
                    "\n⚠️  SECURITY WARNING: Credentials are stored in plaintext!\n"
                    "    Protect your config file:\n"
                    "      chmod 600 ~/.config/ipfs-pin/config.json\n",
                    fg="yellow",
                ))

    else:
        _set_config(key, value)
        click.echo(click.style(f"✅ Configured: {key}", fg="green"))


@config.command("get")
@click.argument("key", default=None, required=False)
def config_get(key):
    """Get a config value (masks secrets)."""
    cfg = _load_config()
    if key:
        val = cfg.get(key, "[not set]")
        if key in ("mnemonic", "evm_private_key", "solana_private_key") and val != "[STORED_IN_KEYRING]":
            val = val[:4] + "..." + val[-4:] if len(val) > 8 else "***"
            click.echo(f"{key}: {val} (truncated)")
        else:
            click.echo(f"{key}: {val}")
    else:
        click.echo(click.style("📋 Current configuration:", fg="cyan"))
        click.echo("")
        for k, v in cfg.items():
            if k in ("mnemonic", "evm_private_key", "solana_private_key"):
                display = "🔒 stored in keyring" if v == "[STORED_IN_KEYRING]" else f"{v[:4]}...{v[-4:] if len(v) > 8 else ''}"
                click.echo(f"  {k}: {display}")
            else:
                click.echo(f"  {k}: {v}")


@config.command("clear")
@click.option("--yes", "-y", "assume_yes", is_flag=True, default=False, help="Skip confirmation prompt")
@click.pass_context
def config_clear(ctx, assume_yes):
    """Clear all config (including keyring secrets)."""
    assume_yes_val = assume_yes or ctx.obj.get("assume_yes", False)
    if assume_yes_val or click.confirm(click.style("Clear all config? This cannot be undone.", fg="yellow")):
        # Clear keyring
        for secret in ("mnemonic", "evm_private_key", "solana_private_key"):
            if HAS_KEYRING:
                try:
                    keyring.delete_password("ipfs-pin", secret)
                except Exception:
                    pass
        # Clear file config
        _save_config({})
        click.echo(click.style("✅ Config cleared", fg="green"))


@cli.command("completion")
@click.argument("shell", type=click.Choice(["bash", "zsh", "fish", "powershell"]))
def completion(shell):
    """Generate shell completion script."""
    if click is None:
        click.echo("Error: click package not installed", file=sys.stderr)
        return
    try:
        from click.shell_completion import install as click_install
        click_install(cli, shell, "_ipfs_pin_complete")
    except Exception as e:
        click.echo(click.style(f"Failed to generate completion: {e}", fg="red"))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    """Main entry point for the ipfs-pin CLI."""
    if click is None:
        click.echo("Error: 'click' package is required. Install with: pip install click", file=sys.stderr)
        sys.exit(1)

    cli(obj={})


if __name__ == "__main__":
    main()
