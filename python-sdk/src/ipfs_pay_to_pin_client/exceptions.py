class PayToPinError(Exception):
    """Base exception for all IPFS Pay-to-Pin client errors."""
    pass


class PaymentRequiredError(PayToPinError):
    """Raised when 402 Payment Required response is returned or payment fails."""
    def __init__(self, message: str, challenge: dict = None):
        super().__init__(message)
        self.challenge = challenge or {}


class InsufficientFundsError(PaymentRequiredError):
    """Raised when the wallet lacks sufficient ALGO or microUSDC balance."""
    pass


class RekeyDetectedError(PayToPinError):
    """Raised when the spending account is rekeyed unexpectedly."""
    pass


class ExceedsMaxPriceError(PayToPinError):
    """Raised when payment requested exceeds user max_price_usdc ceiling."""
    pass


class PinningFailedError(PayToPinError):
    """Raised when upstream pinning fails after settlement."""
    pass
