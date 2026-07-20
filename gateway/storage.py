from abc import ABC, abstractmethod
import os
import httpx
import logging
import hashlib
import base64
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

    @abstractmethod
    def file_exists(self, identifier: str) -> bool:
        """
        Check if a file with the given identifier exists.
        """
        pass

class LocalAdapter(StorageAdapter):
    def __init__(self):
        os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)

    async def pin_file(self, content: bytes, filename: str) -> str:
        # Calculate SHA-256 hash of content to make mock CID
        hasher = hashlib.sha256()
        hasher.update(content)
        digest = hasher.digest()
        mock_cid = base64.b32encode(digest).decode("utf-8").lower().replace("=", "")
        
        file_path = os.path.join(settings.LOCAL_STORAGE_DIR, mock_cid)
        with open(file_path, "wb") as f:
            f.write(content)
            
        return mock_cid

    def store_file(self, content: bytes, filename: str) -> str:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        if loop.is_running():
            # If running in async environment, use a helper run_coroutine_threadsafe or similar,
            # but for tests, loop is not running during this sync call.
            # We can run it using another loop or just run synchronously since it's local.
            return loop.run_until_complete(self.pin_file(content, filename))
        else:
            return loop.run_until_complete(self.pin_file(content, filename))

    def file_exists(self, identifier: str) -> bool:
        file_path = os.path.join(settings.LOCAL_STORAGE_DIR, identifier)
        return os.path.exists(file_path)

class PinataAdapter(StorageAdapter):
    def __init__(self, jwt: str, endpoint: str):
        self.jwt = jwt
        self.endpoint = endpoint
        os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)

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
                    cid = data["IpfsHash"]
                    # Optionally cache locally as well
                    file_path = os.path.join(settings.LOCAL_STORAGE_DIR, cid)
                    with open(file_path, "wb") as f:
                        f.write(content)
                    return cid
                
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

    def file_exists(self, identifier: str) -> bool:
        file_path = os.path.join(settings.LOCAL_STORAGE_DIR, identifier)
        return os.path.exists(file_path)

def get_storage_adapter() -> StorageAdapter:
    adapter_type = settings.STORAGE_ADAPTER.lower()
    if adapter_type == "pinata":
        return PinataAdapter(jwt=settings.PINATA_JWT, endpoint=settings.PINATA_ENDPOINT)
    else:
        return LocalAdapter()

# Setup backward compatibility aliases
BaseStorage = StorageAdapter
LocalStorage = LocalAdapter

def get_storage_provider():
    provider = settings.STORAGE_PROVIDER.lower()
    if provider == "local":
        return LocalAdapter()
    else:
        raise ValueError(f"Unsupported storage provider: {settings.STORAGE_PROVIDER}")


