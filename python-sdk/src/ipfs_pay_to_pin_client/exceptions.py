from __future__ import annotations


class PayToPinError(Exception):
    """Base exception for all IPFS Pay-to-Pin client errors."""


class ConfigurationError(PayToPinError):
    """Raised when the SDK is misconfigured or when invalid inputs are provided to client methods."""


class PaymentRequiredError(PayToPinError):
    """Raised when 402 Payment Required response is returned or payment fails."""
    def __init__(self, message: str, challenge: dict | None = None):
        super().__init__(message)
        self.challenge = challenge or {}


class InsufficientFundsError(PaymentRequiredError):
    """Raised when the wallet lacks sufficient ALGO or microUSDC balance."""


class RekeyDetectedError(PayToPinError):
    """Raised when the spending account is rekeyed unexpectedly."""


class ExceedsMaxPriceError(PayToPinError):
    """Raised when payment requested exceeds user max_price_usdc ceiling."""


class PinningFailedError(PayToPinError):
    """Raised when upstream pinning fails after settlement."""
