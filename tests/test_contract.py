import os
import re
import pytest

TEAL_APPROVAL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "escrow", "PayToPinEscrow.approval.teal"
)

def test_teal_compilation_exists():
    """Verify that compilation output files exist."""
    assert os.path.exists(TEAL_APPROVAL_PATH), f"TEAL approval file not found at {TEAL_APPROVAL_PATH}"

def test_teal_owner_check():
    """Verify that update_pricing and withdraw_fees perform owner check."""
    assert os.path.exists(TEAL_APPROVAL_PATH)
    with open(TEAL_APPROVAL_PATH, "r") as f:
        teal_content = f.read()

    # Locate update_pricing and withdraw_fees subroutines
    # Verify they contain a check of txn Sender against the "owner" global state.
    # Typically: txn Sender, byte "owner", app_global_get_ex, assert, ==, assert
    
    # Let's count occurrences of "owner" state checks
    owner_checks = re.findall(r'bytec_0\s+//\s+"owner"\s+app_global_get_ex', teal_content)
    assert len(owner_checks) >= 4, f"Expected at least 4 owner checks, found {len(owner_checks)}"

def test_teal_rekey_protection():
    """Verify that update_pricing, withdraw_fees, update_application, and delete_application perform RekeyTo zero address assertion."""
    assert os.path.exists(TEAL_APPROVAL_PATH)
    with open(TEAL_APPROVAL_PATH, "r") as f:
        teal_content = f.read()

    normalized_teal = re.sub(r'\s+', ' ', teal_content)
    matches = re.findall(r'txn RekeyTo\s+global ZeroAddress\s+==\s+assert', normalized_teal)
    assert len(matches) >= 4, f"Expected at least 4 rekey checks, found {len(matches)}"
