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
    assert len(owner_checks) >= 2, "Expected at least 2 owner checks (one in update_pricing, one in withdraw_fees)"

def test_teal_rekey_protection():
    """Verify that update_pricing and withdraw_fees perform RekeyTo zero address assertion."""
    assert os.path.exists(TEAL_APPROVAL_PATH)
    with open(TEAL_APPROVAL_PATH, "r") as f:
        teal_content = f.read()

    # Look for:
    # txn RekeyTo
    # global ZeroAddress
    # ==
    # assert
    rekey_protection_matches = re.findall(
        r'txn RekeyTo\s+global ZeroAddress\s+==\s+assert',
        teal_content,
        re.DOTALL
    )
    # The actual TEAL might have comments or formatting, let's normalize whitespace and search:
    normalized_teal = re.sub(r'\s+', ' ', teal_content)
    
    # Match the pattern: txn RekeyTo global ZeroAddress == assert
    matches = re.findall(r'txn RekeyTo\s+global ZeroAddress\s+==\s+assert', normalized_teal)
    assert len(matches) >= 2, "Expected at least 2 rekey checks (one in update_pricing, one in withdraw_fees)"
