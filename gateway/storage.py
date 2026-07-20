from abc import ABC, abstractmethod
import httpx
import logging
from gateway.config import settings

logger = logging.getLogger(__name__)

class StorageException(Exception):
    """Base exception for storage adapter operations."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code

class StorageAdapter(ABC):
    @abstractmethod
    async def pin_file(self, content: bytes, filename: str) -> str:
        """
        Uploads/pins a file and returns its IPFS CID.
        Raises a StorageException on failure.
        """
        pass

class LocalAdapter(StorageAdapter):
    async def pin_file(self, content: bytes, filename: str) -> str:
        # Simulated successful pinning output
        return "QmYwAPJzv5CZ1sAXXtDURmBNBAeXnuL13xNu18q1eLd8d5"

class PinataAdapter(StorageAdapter):
    def __init__(self, jwt: str, endpoint: str):
        self.jwt = jwt
        self.endpoint = endpoint

    async def pin_file(self, content: bytes, filename: str) -> str:
        if not self.jwt:
            logger.error("Pinata JWT configuration is missing.")
            raise StorageException("Pinata JWT configuration is missing.", status_code=502)

        headers = {
            "Authorization": f"Bearer {self.jwt}"
        }
        files = {
            "file": (filename, content, "application/octet-stream")
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.endpoint, headers=headers, files=files, timeout=30.0)
                
                if response.status_code == 200:
                    data = response.json()
                    return data["IpfsHash"]
                
                # Handle error responses
                error_msg = f"Pinata API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                
                if response.status_code == 401:
                    raise StorageException("Unauthorized: Invalid Pinata JWT.", status_code=502)
                elif response.status_code in (400, 415):
                    raise StorageException(f"Bad Request: {response.text}", status_code=400)
                elif response.status_code == 429:
                    raise StorageException("Too Many Requests: Rate limited by Pinata.", status_code=429)
                elif response.status_code >= 500:
                    raise StorageException("Service Unavailable: Pinata API is down.", status_code=503)
                else:
                    raise StorageException(f"Unhandled Pinata error: {response.status_code}", status_code=500)
                    
        except httpx.RequestError as exc:
            logger.error(f"Network error contacting Pinata: {exc}")
            raise StorageException(f"Network error contacting Pinata: {exc}", status_code=503)

def get_storage_adapter() -> StorageAdapter:
    adapter_type = settings.STORAGE_ADAPTER.lower()
    if adapter_type == "pinata":
        return PinataAdapter(jwt=settings.PINATA_JWT, endpoint=settings.PINATA_ENDPOINT)
    else:
        return LocalAdapter()
