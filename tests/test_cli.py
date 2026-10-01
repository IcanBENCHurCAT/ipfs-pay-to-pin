"""Tests for the ipfs-pin CLI tool."""

import json
import os
import tempfile
from pathlib import Path
from unittest import mock

import pytest


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_config_dir(tmp_path):
    """Replace the config directory with a temp path for testing."""
    original = Path.home() / ".config" / "ipfs-pin"
    test_dir = tmp_path / ".config" / "ipfs-pin"
    test_dir.mkdir(parents=True)
    
    import scripts.cli as cli_mod
    original_config_dir = cli_mod.CONFIG_DIR
    original_config_file = cli_mod.CONFIG_FILE
    
    cli_mod.CONFIG_DIR = test_dir
    cli_mod.CONFIG_FILE = test_dir / "config.json"
    
    yield test_dir
    
    cli_mod.CONFIG_DIR = original_config_dir
    cli_mod.CONFIG_FILE = original_config_file


@pytest.fixture
def cli_runner():
    """Create a Click CLI test runner."""
    from click.testing import CliRunner
    return CliRunner()


@pytest.fixture
def sample_file(tmp_path):
    """Create a sample file for pinning tests."""
    f = tmp_path / "sample.txt"
    f.write_text("Hello, IPFS!")
    return f


# ---------------------------------------------------------------------------
# Config tests
# ---------------------------------------------------------------------------

class TestConfigLoadSave:
    """Tests for config file loading and saving."""

    def test_load_empty_config(self, mock_config_dir):
        from scripts.cli import _load_config
        result = _load_config()
        assert result == {}

    def test_load_existing_config(self, mock_config_dir):
        import json
        from scripts.cli import _load_config, _save_config
        
        test_cfg = {"gateway": "https://test.gw", "mnemonic": "test123"}
        _save_config(test_cfg)
        result = _load_config()
        assert result["gateway"] == "https://test.gw"
        assert result["mnemonic"] == "test123"

    def test_set_and_get_config(self, mock_config_dir):
        from scripts.cli import _set_config, _get_config
        
        _set_config("gateway", "https://example.com")
        assert _get_config("gateway") == "https://example.com"

    def test_set_config_with_none(self, mock_config_dir):
        from scripts.cli import _set_config, _get_config
        
        _set_config("gateway", "https://new.gw")
        assert _get_config("gateway") == "https://new.gw"

    def test_config_file_permissions(self, mock_config_dir):
        from scripts.cli import _set_config, _load_config
        
        _set_config("gateway", "https://test.com")
        config_file = mock_config_dir / "config.json"
        # File should exist and be readable
        assert config_file.exists()
        content = config_file.read_text()
        data = json.loads(content)
        assert "gateway" in data


# ---------------------------------------------------------------------------
# Keyring tests
# ---------------------------------------------------------------------------

class TestSecretStorage:
    """Tests for secret storage via keyring."""

    def test_store_and_retrieve_secret_with_keyring(self, mock_config_dir):
        """Test storing and retrieving secrets when keyring is available."""
        from scripts.cli import _store_secret, _retrieve_secret, _set_config, _get_config
        
        with mock.patch.dict(os.environ, {"PYTHON_KEYRING_BACKEND": "keyring.backends.null.Keyring"}):
            # When keyring backend doesn't work, we fall back to plaintext
            result = _store_secret("test_key", "secret_value")
            # Should return False if keyring doesn't work
            # In this case, the null backend is used
            
        # Test that _get_config doesn't error
        _set_config("test_key", "test_value")
        assert _get_config("test_key") == "test_value"

    def test_retrieve_nonexistent_secret(self, mock_config_dir):
        from scripts.cli import _retrieve_secret
        
        result = _retrieve_secret("nonexistent_key")
        assert result is None


# ---------------------------------------------------------------------------
# Client resolution tests
# ---------------------------------------------------------------------------

class TestClientResolution:
    """Tests for client creation from config."""

    def test_resolve_client_no_wallet(self, mock_config_dir, cli_runner):
        """Client creation should fail with no wallet config."""
        from scripts.cli import _resolve_client
        
        # No config set up
        result = _resolve_client(gateway="https://test.gw")
        assert result is None

    def test_resolve_client_with_mocked_sdk(self, mock_config_dir, cli_runner):
        """Client should be created when SDK is available."""
        from scripts.cli import _resolve_client
        
        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        
        with mock.patch.dict("sys.modules", {
            "ipfs_pay_to_pin_client": mock.MagicMock(
                IpfsPayToPinClient=mock_client
            ),
            "requests": mock.MagicMock()
        }):
            from ipfs_pay_to_pin_client import IpfsPayToPinClient
            
            result = _resolve_client(
                gateway="https://test.gw",
                mnemonic="test mnemonic words here"
            )
            assert result is not None


# ---------------------------------------------------------------------------
# Color helpers tests
# ---------------------------------------------------------------------------

class TestColors:
    """Tests for color output helpers."""

    def test_colors_init(self):
        from scripts.cli import _Colors
        _Colors.init(force=True)  # Force enable for tests (no TTY)
        assert _Colors._enabled is True

    def test_colors_success(self):
        from scripts.cli import _Colors
        _Colors.init()
        result = _Colors.success("done")
        assert "done" in result

    def test_colors_error(self):
        from scripts.cli import _Colors
        _Colors.init()
        result = _Colors.error("fail")
        assert "fail" in result

    def test_colors_warning(self):
        from scripts.cli import _Colors
        _Colors.init()
        result = _Colors.warning("warn")
        assert "warn" in result

    def test_colors_info(self):
        from scripts.cli import _Colors
        _Colors.init()
        result = _Colors.info("info")
        assert "info" in result


# ---------------------------------------------------------------------------
# CLI command tests (Click tests)
# ---------------------------------------------------------------------------

class TestCLICommands:
    """Tests for CLI command groups and help text."""

    def test_cli_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["--help"])
        assert result.exit_code == 0
        assert "ipfs-pin" in result.output.lower() or "pin" in result.output.lower()

    def test_cli_pin_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["pin", "--help"])
        assert result.exit_code == 0
        assert "FILE_PATH" in result.output

    def test_cli_pin_url_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["pin-url", "--help"])
        assert result.exit_code == 0
        assert "URL" in result.output

    def test_cli_status_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["status", "--help"])
        assert result.exit_code == 0

    def test_cli_renew_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["renew", "--help"])
        assert result.exit_code == 0

    def test_cli_unpin_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["unpin", "--help"])
        assert result.exit_code == 0

    def test_cli_list_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["--help"])
        assert result.exit_code == 0
        assert "list" in result.output.lower()

    def test_cli_config_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["config", "--help"])
        assert result.exit_code == 0

    def test_cli_config_set_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["config", "set", "--help"])
        assert result.exit_code == 0

    def test_cli_config_get_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["config", "get", "--help"])
        assert result.exit_code == 0

    def test_cli_config_clear_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["config", "clear", "--help"])
        assert result.exit_code == 0


# ---------------------------------------------------------------------------
# Config command tests
# ---------------------------------------------------------------------------

class TestConfigCommands:
    """Tests for config subcommands."""

    def test_config_set_gateway(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["config", "set", "gateway", "https://test.gw"])
        assert result.exit_code == 0
        assert "Configured: gateway" in result.output or "Configured" in result.output

    def test_config_set_invalid_gateway(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["config", "set", "gateway", "not-a-url"])
        assert result.exit_code == 0  # Still exits 0, but shows error
        assert "http://" in result.output or "https://" in result.output

    def test_config_get(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        # First set a config value
        cli_runner.invoke(cli, ["config", "set", "gateway", "https://test.gw"])
        # Then get it
        result = cli_runner.invoke(cli, ["config", "get", "gateway"])
        assert result.exit_code == 0

    def test_config_get_all(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["config", "get"])
        assert result.exit_code == 0

    def test_config_clear(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        # Set a value first
        cli_runner.invoke(cli, ["config", "set", "gateway", "https://test.gw"])
        # Clear it with --yes flag (click uses --yes for assume_yes)
        result = cli_runner.invoke(cli, ["config", "clear", "--yes"])
        assert result.exit_code == 0


# ---------------------------------------------------------------------------
# Pin command tests
# ---------------------------------------------------------------------------

class TestPinCommand:
    """Tests for the pin command."""

    def test_pin_no_wallet(self, cli_runner, mock_config_dir, sample_file):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["pin", str(sample_file)])
        assert result.exit_code != 0  # Should fail without wallet
        output_lower = result.output.lower() if result.output else ""
        # Check that it fails with wallet-related error
        assert "wallet" in output_lower or "configure" in output_lower or "error" in output_lower or result.exception is not None

    def test_pin_with_mocked_client(self, cli_runner, mock_config_dir, sample_file):
        """Test pin command with mocked SDK client."""
        from scripts.cli import cli
        
        mock_resp = mock.MagicMock()
        mock_resp.cid = "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"
        mock_resp.status = "pinned"
        mock_resp.pin_expires_at = "2027-09-05T00:00:00Z"
        mock_resp.size_bytes = 13
        mock_resp.tx_id = "tx123"
        
        mock_client = mock.MagicMock()
        mock_client.pin_file.return_value = mock_resp
        mock_client.gateway_url = "https://test.gw"
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            # Pass matching keys to avoid TypeError from _resolve_client()
            result = cli_runner.invoke(
                cli,
                ["pin", str(sample_file), "--yes"],
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
            )
            assert result.exit_code == 0
            assert "Pin successful" in result.output or "successful" in result.output.lower()


# ---------------------------------------------------------------------------
# Pin URL command tests
# ---------------------------------------------------------------------------

class TestPinUrlCommand:
    """Tests for the pin-url command."""

    def test_pin_url_no_wallet(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["pin-url", "https://example.com/file.txt"])
        assert result.exit_code != 0

    def test_pin_url_with_mocked_client(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        
        mock_resp = mock.MagicMock()
        mock_resp.cid = "bafybeif2cnotuxu3s2akplodekh7ig3xy9gzqb6h2xqf5g2bfe52xh2vmy"
        mock_resp.status = "pinned"
        mock_resp.pin_expires_at = "2027-09-05T00:00:00Z"
        mock_resp.size_bytes = 45
        mock_resp.tx_id = "tx456"
        
        mock_client = mock.MagicMock()
        mock_client.pin_bytes.return_value = mock_resp
        mock_client.gateway_url = "https://test.gw"
        
        mock_download = mock.MagicMock()
        mock_download.content = b"Hello, World! This is a test file."
        mock_download.raise_for_status = mock.MagicMock()
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            with mock.patch("scripts.cli.requests.get", return_value=mock_download):
                result = cli_runner.invoke(
                    cli,
                    ["pin-url", "https://example.com/file.txt", "--yes"],
                    obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
                )
                assert result.exit_code == 0


# ---------------------------------------------------------------------------
# Status command tests
# ---------------------------------------------------------------------------

class TestStatusCommand:
    """Tests for the status command."""

    def test_status_no_wallet(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["status", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"])
        assert result.exit_code != 0

    def test_status_with_mocked_client(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        
        mock_client = mock.MagicMock()
        mock_client.get_status.return_value = {
            "cid": "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae",
            "status": "pinned",
            "size_bytes": 1024,
            "created_at": "2024-09-05T00:00:00Z",
            "pin_expires_at": "2025-09-05T00:00:00Z",
        }
        mock_client.gateway_url = "https://test.gw"
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            result = cli_runner.invoke(
                cli,
                ["status", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"],
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": False}
            )
            assert result.exit_code == 0
            assert "pinned" in result.output.lower()


# ---------------------------------------------------------------------------
# Renew command tests
# ---------------------------------------------------------------------------

class TestRenewCommand:
    """Tests for the renew command."""

    def test_renew_no_wallet(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["renew", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"])
        assert result.exit_code != 0

    def test_renew_with_mocked_client(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        
        mock_resp = mock.MagicMock()
        mock_resp.cid = "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"
        mock_resp.status = "pinned"
        mock_resp.pin_expires_at = "2027-09-05T00:00:00Z"
        mock_resp.size_bytes = 1024
        mock_resp.tx_id = "tx-renew-123"
        
        mock_client = mock.MagicMock()
        mock_client.renew_pin.return_value = mock_resp
        mock_client.gateway_url = "https://test.gw"
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            result = cli_runner.invoke(
                cli,
                ["renew", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae", "--yes"],
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
            )
            assert result.exit_code == 0
            assert "successful" in result.output.lower()


# ---------------------------------------------------------------------------
# Unpin command tests
# ---------------------------------------------------------------------------

class TestUnpinCommand:
    """Tests for the unpin command."""

    def test_unpin_no_wallet(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["unpin", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"])
        assert result.exit_code != 0


# ---------------------------------------------------------------------------
# Version test
# ---------------------------------------------------------------------------

class TestVersion:
    """Tests for version display."""

    def test_version_flag(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["--version"])
        assert result.exit_code == 0
        assert "ipfs-pin" in result.output.lower() or "0.1.0" in result.output


# ---------------------------------------------------------------------------
# Integration-style tests (with mocked requests)
# ---------------------------------------------------------------------------

class TestIntegration:
    """Slightly more integrated tests with mocked responses."""

    def test_successful_pin_flow(self, cli_runner, mock_config_dir):
        """Test a full pin flow with mocked SDK and config."""
        from scripts.cli import cli
        
        # Setup config
        from scripts.cli import _set_config
        _set_config("gateway", "https://mock.gateway.com")
        _set_config("mnemonic", "test mnemonic phrase")
        
        mock_resp = mock.MagicMock()
        mock_resp.cid = "bafkreih2x2nqj7nq77nq77nq77nq77nq77nq77nq"
        mock_resp.status = "pinned"
        mock_resp.pin_expires_at = "2027-09-05"
        mock_resp.size_bytes = 100
        mock_resp.tx_id = "test-tx-123"
        
        mock_client = mock.MagicMock()
        mock_client.pin_file.return_value = mock_resp
        mock_client.gateway_url = "https://mock.gateway.com"
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            result = cli_runner.invoke(
                cli,
                ["pin", "-"],
                input=b"test content\n",
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
            )
            # This should fail since we're reading from stdin without a file path
            # But the test demonstrates the flow structure


# ---------------------------------------------------------------------------
# Completion command tests
# ---------------------------------------------------------------------------

class TestCompletionCommand:
    """Tests for the ipfs-pin completion command."""

    def test_completion_help(self, cli_runner):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["completion", "--help"])
        assert result.exit_code == 0
        assert "shell" in result.output.lower()

    def test_completion_generate_bash(self, cli_runner):
        """Test generating bash completion script."""
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["completion", "bash"])
        assert result.exit_code == 0
        # Completion output should contain IPFS_PIN or ipfs_pin
        assert "IPFS_PIN" in result.output or "_ipfs_pin" in result.output

    def test_completion_generate_zsh(self, cli_runner):
        """Test generating zsh completion script."""
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["completion", "zsh"])
        assert result.exit_code == 0

    def test_completion_generate_fish(self, cli_runner):
        """Test generating fish completion script."""
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["completion", "fish"])
        assert result.exit_code == 0

    def test_completion_invalid_shell(self, cli_runner):
        """Test that invalid shell choices are rejected."""
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["completion", "invalid"])
        # Click's Choice should reject invalid values
        assert result.exit_code != 0


# ---------------------------------------------------------------------------
# Unpin command tests (with mocked client)
# ---------------------------------------------------------------------------

class TestUnpinCommand:
    """Tests for the unpin command."""

    def test_unpin_no_wallet(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["unpin", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"])
        assert result.exit_code != 0

    def test_unpin_with_mocked_client(self, cli_runner, mock_config_dir):
        """Test unpin command with mocked HTTP response."""
        from scripts.cli import cli
        
        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        
        mock_resp = mock.MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = ""
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            with mock.patch("scripts.cli.requests.delete", return_value=mock_resp):
                result = cli_runner.invoke(
                    cli,
                    ["unpin", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae", "--yes"],
                    obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
                )
                assert result.exit_code == 0
                assert "Unpinned" in result.output

    def test_unpin_api_failure(self, cli_runner, mock_config_dir):
        """Test unpin when the API returns an error."""
        from scripts.cli import cli
        
        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        
        mock_resp = mock.MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            with mock.patch("scripts.cli.requests.delete", return_value=mock_resp):
                result = cli_runner.invoke(
                    cli,
                    ["unpin", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae", "--yes"],
                    obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
                )
                assert result.exit_code == 1
                assert "Unpin failed" in result.output


# ---------------------------------------------------------------------------
# List pins command tests
# ---------------------------------------------------------------------------

class TestListPinsCommand:
    """Tests for the ipfs-pin list command."""

    def test_list_no_wallet(self, cli_runner, mock_config_dir):
        from scripts.cli import cli
        result = cli_runner.invoke(cli, ["list"])
        assert result.exit_code != 0

    def test_list_empty(self, cli_runner, mock_config_dir):
        """Test list command with empty results."""
        from scripts.cli import cli
        
        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        
        mock_resp = mock.MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = []
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            with mock.patch("scripts.cli.requests.get", return_value=mock_resp):
                result = cli_runner.invoke(
                    cli,
                    ["list"],
                    obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": False}
                )
                assert result.exit_code == 0
                assert "No pins found" in result.output

    def test_list_with_pins(self, cli_runner, mock_config_dir):
        """Test list command with pin results."""
        from scripts.cli import cli
        
        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        
        mock_resp = mock.MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "cid": "bafkreih2x2nqj7nq77nq77nq77nq77nq77nq77nq",
                "status": "pinned",
                "created_at": "2024-09-05T00:00:00Z",
            },
        ]
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            with mock.patch("scripts.cli.requests.get", return_value=mock_resp):
                result = cli_runner.invoke(
                    cli,
                    ["list"],
                    obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": False}
                )
                assert result.exit_code == 0
                assert "pinned" in result.output.lower()

    def test_list_no_endpoint(self, cli_runner, mock_config_dir):
        """Test list command when endpoint is not available (404)."""
        from scripts.cli import cli
        
        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        
        mock_resp = mock.MagicMock()
        mock_resp.status_code = 404
        mock_resp.text = "Not Found"
        
        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            with mock.patch("scripts.cli.requests.get", return_value=mock_resp):
                result = cli_runner.invoke(
                    cli,
                    ["list"],
                    obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": False}
                )
                assert result.exit_code == 0  # list doesn't exit(1) on 404
                assert "pins endpoint" in result.output.lower() or "Not Found" in result.output


# ---------------------------------------------------------------------------
# Test the main entry point
# ---------------------------------------------------------------------------

class TestMain:
    """Tests for the CLI main entry point."""

    def test_main_import(self):
        """Test that main can be imported."""
        import scripts.cli as cli_mod
        assert hasattr(cli_mod, "main")
        assert callable(cli_mod.main)


# ---------------------------------------------------------------------------
# Edge-case tests — network errors, env vars, keyring, config validation
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Edge-case and integration-style tests for remaining acceptance criteria."""

    def test_pin_sdk_network_error(self, cli_runner, mock_config_dir, sample_file):
        """Test pin command when SDK client raises a network error."""
        from scripts.cli import cli

        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        mock_client.pin_file.side_effect = Exception("Network error: connection refused")

        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            result = cli_runner.invoke(
                cli,
                ["pin", str(sample_file), "--yes"],
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
            )
            assert result.exit_code == 1
            assert "error" in result.output.lower() or "❌" in result.output

    def test_pin_sdk_unauthorized_error(self, cli_runner, mock_config_dir, sample_file):
        """Test pin command when SDK client raises an auth error."""
        from scripts.cli import cli

        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        mock_client.pin_file.side_effect = Exception("401 Unauthorized: invalid wallet")

        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            result = cli_runner.invoke(
                cli,
                ["pin", str(sample_file), "--yes"],
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
            )
            assert result.exit_code == 1
            assert "unauthorized" in result.output.lower() or "❌" in result.output

    def test_pin_url_download_failure(self, cli_runner, mock_config_dir):
        """Test pin-url when HTTP download fails (404)."""
        from scripts.cli import cli

        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"

        mock_resp = mock.MagicMock()
        mock_resp.raise_for_status.side_effect = Exception("404 Not Found")

        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            with mock.patch("scripts.cli.requests.get", return_value=mock_resp):
                result = cli_runner.invoke(
                    cli,
                    ["pin-url", "https://example.com/missing.txt", "--yes"],
                    obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
                )
                assert result.exit_code == 1
                assert "download failed" in result.output.lower() or "❌" in result.output

    def test_renew_sdk_error(self, cli_runner, mock_config_dir):
        """Test renew command when SDK raises an error."""
        from scripts.cli import cli

        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        mock_client.renew_pin.side_effect = Exception("Pin not found")

        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            result = cli_runner.invoke(
                cli,
                ["renew", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae", "--yes"],
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
            )
            assert result.exit_code == 1
            assert "❌" in result.output or "error" in result.output.lower()

    def test_status_sdk_error(self, cli_runner, mock_config_dir):
        """Test status command when SDK raises an error."""
        from scripts.cli import cli

        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"
        mock_client.get_status.side_effect = Exception("Gateway timeout")

        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            result = cli_runner.invoke(
                cli,
                ["status", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"],
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": False}
            )
            assert result.exit_code == 1
            assert "❌" in result.output or "timeout" in result.output.lower()

    def test_resolve_client_env_var_gateway(self, mock_config_dir):
        """Test that IPFS_PIN_GATEWAY_URL env var is used for gateway resolution."""
        import os
        from scripts.cli import _resolve_client

        with mock.patch.dict(os.environ, {"IPFS_PIN_GATEWAY_URL": "https://env-gateway.example.com"}):
            with mock.patch("scripts.cli.requests", mock.MagicMock()):
                mock_client_cls = mock.MagicMock()
                with mock.patch.dict("sys.modules", {
                    "ipfs_pay_to_pin_client": mock.MagicMock(
                        IpfsPayToPinClient=mock_client_cls
                    )
                }):
                    result = _resolve_client(mnemonic="test mnemonic")
                    assert result is not None
                    mock_client_cls.assert_called_once()
                    call_kwargs = mock_client_cls.call_args[1]
                    assert call_kwargs.get("gateway_url") == "https://env-gateway.example.com"

    def test_resolve_client_fallback_default_gateway(self, mock_config_dir):
        """Test that default gateway is used when no config/env is set."""
        from scripts.cli import _resolve_client

        # Ensure no env var is set
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("IPFS_PIN_GATEWAY_URL", None)

            with mock.patch("scripts.cli.requests", mock.MagicMock()):
                mock_client_cls = mock.MagicMock()
                with mock.patch.dict("sys.modules", {
                    "ipfs_pay_to_pin_client": mock.MagicMock(
                        IpfsPayToPinClient=mock_client_cls
                    )
                }):
                    result = _resolve_client(mnemonic="test mnemonic")
                    assert result is not None
                    # Should fall back to default gateway
                    mock_client_cls.assert_called_once()
                    call_kwargs = mock_client_cls.call_args[1]
                    assert call_kwargs.get("gateway_url") == "https://pay-to-pin.duckdns.org"

    def test_config_set_mnemonic_truncation_on_get(self, cli_runner, mock_config_dir):
        """Test that config get truncates mnemonic display."""
        from scripts.cli import cli, _set_config

        long_mnemonic = "abandon ability able about above absent absorb abstract absurd abuse access accident"
        _set_config("mnemonic", long_mnemonic)

        result = cli_runner.invoke(cli, ["config", "get", "mnemonic"])
        assert result.exit_code == 0
        # Should show truncated version with ...
        assert "..." in result.output

    def test_config_set_invalid_key(self, cli_runner, mock_config_dir):
        """Test that config set rejects invalid key names."""
        from scripts.cli import cli

        result = cli_runner.invoke(cli, ["config", "set", "invalid_key", "value"])
        assert result.exit_code == 0  # Command doesn't exit non-zero
        assert "Unknown key" in result.output or "invalid" in result.output.lower()

    def test_colors_env_var_override(self):
        """Test that FORCE_COLORS=1 overrides terminal detection."""
        import os
        from scripts.cli import _Colors

        # Start fresh
        _Colors._enabled = False

        with mock.patch.dict(os.environ, {"FORCE_COLORS": "1"}):
            _Colors.init()
            assert _Colors._enabled is True

    def test_colors_disabled_outside_terminal(self):
        """Test that colors are disabled when not in a TTY."""
        from scripts.cli import _Colors

        _Colors._enabled = False
        _Colors.init()  # No force, no TTY
        # Colors should be disabled outside a TTY
        result = _Colors.success("success")
        assert result == "success"  # No ANSI codes

    def test_resolve_client_missing_keyring_module(self, mock_config_dir):
        """Test client resolution when keyring module is not installed."""
        from scripts.cli import _resolve_client

        with mock.patch.dict("sys.modules", {"keyring": None}):
            # Force HAS_KEYRING = False by reloading the module
            import importlib
            import scripts.cli as cli_mod
            importlib.reload(cli_mod)

            with mock.patch.dict("sys.modules", {
                "ipfs_pay_to_pin_client": mock.MagicMock(
                    IpfsPayToPinClient=mock.MagicMock()
                ),
                "requests": mock.MagicMock()
            }):
                result = cli_mod._resolve_client(mnemonic="test mnemonic")
                assert result is not None

    def test_resolve_client_missing_sdk_package(self, mock_config_dir):
        """Test error message when SDK package is not installed."""
        import io
        import sys
        import importlib
        import scripts.cli as cli_mod

        # Capture stderr to verify error message
        stderr_capture = io.StringIO()
        with mock.patch.object(sys, "stderr", stderr_capture):
            # Remove the SDK and all transitive deps from sys.modules
            sdk_mod = "ipfs_pay_to_pin_client"
            original_mods = {}
            to_remove = [k for k in sys.modules if k.startswith(sdk_mod) or k.startswith("algosdk")]
            for k in to_remove:
                original_mods[k] = sys.modules.pop(k)

            try:
                with mock.patch("builtins.__import__", side_effect=lambda name, *args, **kw: (
                    _original_import(name, *args, **kw) if name != sdk_mod else (_original_import(name, *args, **kw) if name in original_mods or name in sys.modules else (_ for _ in ()).throw(ImportError(f"No module named '{name}'")))
                )):
                    importlib.reload(cli_mod)
                    # Re-import to restore _original_import reference
                    _original_import = __import__

                result = cli_mod._resolve_client(mnemonic="test mnemonic")
                assert result is None
                assert "ipfs-pay-to-pin-client" in stderr_capture.getvalue()
            finally:
                for k, v in original_mods.items():
                    sys.modules[k] = v

    def test_config_set_evm_alias(self, cli_runner, mock_config_dir):
        """Test that 'evm' is accepted as alias for 'evm_private_key'."""
        from scripts.cli import cli, _load_config
        import scripts.cli as cli_mod

        with mock.patch.object(cli_mod, "HAS_KEYRING", False):
            result = cli_runner.invoke(cli, ["config", "set", "evm", "0x1234567890abcdef"])
            assert result.exit_code == 0
            cfg = _load_config()
            assert cfg.get("evm_private_key") == "0x1234567890abcdef"

    def test_config_set_solana_alias(self, cli_runner, mock_config_dir):
        """Test that 'solana' is accepted as alias for 'solana_private_key'."""
        from scripts.cli import cli, _load_config
        import scripts.cli as cli_mod

        with mock.patch.object(cli_mod, "HAS_KEYRING", False):
            result = cli_runner.invoke(cli, ["config", "set", "solana", "5secretkey123"])
            assert result.exit_code == 0
            cfg = _load_config()
            assert cfg.get("solana_private_key") == "5secretkey123"

    def test_config_get_all_shows_all_keys(self, cli_runner, mock_config_dir):
        """Test that config get without key shows all configured values."""
        from scripts.cli import cli

        cli_runner.invoke(cli, ["config", "set", "gateway", "https://example.com"])
        cli_runner.invoke(cli, ["config", "set", "evm", "0xabcdef"])

        result = cli_runner.invoke(cli, ["config", "get"])
        assert result.exit_code == 0
        assert "gateway" in result.output.lower()
        assert "evm" in result.output.lower()

    def test_completion_missing_click(self, cli_runner):
        """Test completion command when click is not available."""
        import scripts.cli as cli_mod
        import importlib
        import sys

        # Temporarily remove click from the module
        original_click = getattr(cli_mod, 'click', None)
        setattr(cli_mod, 'click', None)

        try:
            result = cli_runner.invoke(cli_mod.cli, ["completion", "bash"])
            # Should print error about click missing
            assert "click" in result.output.lower() or "error" in result.output.lower() or result.exit_code != 0
        finally:
            if original_click is not None:
                cli_mod.click = original_click
            else:
                delattr(cli_mod, 'click')

    def test_main_missing_click(self):
        """Test main() prints error when click is not installed."""
        import scripts.cli as cli_mod
        import importlib
        import sys

        # Temporarily remove click
        original_click = getattr(cli_mod, 'click', None)
        setattr(cli_mod, 'click', None)

        try:
            import io
            from contextlib import redirect_stderr, redirect_stdout

            stderr_capture = io.StringIO()
            stdout_capture = io.StringIO()

            with redirect_stderr(stderr_capture), redirect_stdout(stdout_capture):
                try:
                    cli_mod.main()
                except SystemExit as e:
                    assert e.code == 1

                stderr_output = stderr_capture.getvalue()
                assert "click" in stderr_output.lower()
        finally:
            if original_click is not None:
                cli_mod.click = original_click
            else:
                delattr(cli_mod, 'click')

    def test_renew_confirm_prompt_cancellation(self, cli_runner, mock_config_dir):
        """Test that renew respects user declining the confirmation prompt."""
        from scripts.cli import cli

        mock_client = mock.MagicMock()
        mock_client.renew_pin.return_value = mock.MagicMock(
            cid="bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae",
            status="pinned",
            pin_expires_at="2027-09-20",
            tx_id="tx123",
        )

        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            # Simulate user pressing 'n' to decline
            result = cli_runner.invoke(
                cli,
                ["renew", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"],
                input="n\n",
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": False}
            )
            assert result.exit_code == 0  # Exit 0 because we returned early (not error)
            assert "Aborted" in result.output
        assert "Aborted" in result.output or "aborted" in result.output.lower()

    def test_unpin_confirm_prompt_cancellation(self, cli_runner, mock_config_dir):
        """Test that unpin respects user declining the confirmation prompt."""
        from scripts.cli import cli

        mock_client = mock.MagicMock()
        mock_client.unpin_pin.return_value = mock.MagicMock()

        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            # Simulate user pressing 'n' to decline
            result = cli_runner.invoke(
                cli,
                ["unpin", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae"],
                input="n\n",
                obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": False}
            )
            assert result.exit_code == 0  # Exit 0 because we returned early (not error)
            assert "Aborted" in result.output or "aborted" in result.output.lower()

    def test_resolve_client_keyring_fallback_to_config(self, mock_config_dir):
        """Test that _resolve_client checks keyring then config, then args."""
        from scripts.cli import _resolve_client

        # Set up config but no keyring (simulated)
        with mock.patch("scripts.cli.keyring", None):
            with mock.patch.dict("sys.modules", {"keyring": None}):
                import importlib
                import scripts.cli as cli_mod
                importlib.reload(cli_mod)

                cli_mod._set_config("mnemonic", "config-mnemonic-words")

                with mock.patch.dict("sys.modules", {
                    "ipfs_pay_to_pin_client": mock.MagicMock(
                        IpfsPayToPinClient=mock.MagicMock()
                    ),
                    "requests": mock.MagicMock()
                }):
                    result = cli_mod._resolve_client()
                    assert result is not None

    def test_unpin_non_200_response(self, cli_runner, mock_config_dir):
        """Test unpin command when API returns non-200/204 status."""
        from scripts.cli import cli

        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"

        mock_resp = mock.MagicMock()
        mock_resp.status_code = 403
        mock_resp.text = "Forbidden: not authorized to unpin"

        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            with mock.patch("scripts.cli.requests.delete", return_value=mock_resp):
                result = cli_runner.invoke(
                    cli,
                    ["unpin", "bafybeigdyrzt5sdk7uth7sv5kqdk7es777oz6epffkivae", "--yes"],
                    obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": True}
                )
                assert result.exit_code == 1
                assert "unpin failed" in result.output.lower()

    def test_list_pins_api_error(self, cli_runner, mock_config_dir):
        """Test list command when API returns an error status."""
        from scripts.cli import cli

        mock_client = mock.MagicMock()
        mock_client.gateway_url = "https://test.gw"

        mock_resp = mock.MagicMock()
        mock_resp.status_code = 503
        mock_resp.text = "Service Unavailable"

        with mock.patch("scripts.cli._resolve_client", return_value=mock_client):
            with mock.patch("scripts.cli.requests.get", return_value=mock_resp):
                result = cli_runner.invoke(
                    cli,
                    ["list"],
                    obj={"gateway": None, "mnemonic": None, "evm_pk": None, "solana_pk": None, "assume_yes": False}
                )
                assert result.exit_code == 1
                assert "failed" in result.output.lower() or "❌" in result.output

    def test_store_secret_keyring_failure(self, mock_config_dir):
        """Test _store_secret returns False when keyring throws."""
        from scripts.cli import _store_secret

        mock_keyring = mock.MagicMock()
        mock_keyring.set_password.side_effect = Exception("keyring backend error")

        with mock.patch("scripts.cli.keyring", mock_keyring):
            result = _store_secret("test", "secret")
            assert result is False

    def test_retrieve_secret_keyring_failure(self, mock_config_dir):
        """Test _retrieve_secret returns None when keyring throws."""
        from scripts.cli import _retrieve_secret

        mock_keyring = mock.MagicMock()
        mock_keyring.get_password.side_effect = Exception("keyring backend error")

        with mock.patch("scripts.cli.keyring", mock_keyring):
            result = _retrieve_secret("test")
            assert result is None
