"""A client library for accessing IPFS Pay-to-Pin Gateway API"""

from .client import AuthenticatedClient, Client

__all__ = (
    "AuthenticatedClient",
    "Client",
)
