from abc import ABC, abstractmethod
import os
import hashlib
import base64
from gateway.config import settings

class BaseStorage(ABC):
    @abstractmethod
    def store_file(self, content: bytes, filename: str) -> str:
        """
        Store file content and return the file identifier (mock CID).
        """
        pass

    @abstractmethod
    def file_exists(self, identifier: str) -> bool:
        """
        Check if a file with the given identifier exists.
        """
        pass

class LocalStorage(BaseStorage):
    def __init__(self):
        os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)

    def store_file(self, content: bytes, filename: str) -> str:
        os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)
        
        # Calculate SHA-256 hash of content
        hasher = hashlib.sha256()
        hasher.update(content)
        digest = hasher.digest()
        
        # Encode to base32, decode to str, make lowercase, and remove padding
        mock_cid = base64.b32encode(digest).decode("utf-8").lower().replace("=", "")
        
        file_path = os.path.join(settings.LOCAL_STORAGE_DIR, mock_cid)
        with open(file_path, "wb") as f:
            f.write(content)
            
        return mock_cid

    def file_exists(self, identifier: str) -> bool:
        file_path = os.path.join(settings.LOCAL_STORAGE_DIR, identifier)
        return os.path.exists(file_path)

def get_storage_provider() -> BaseStorage:
    provider = settings.STORAGE_PROVIDER.lower()
    if provider == "local":
        return LocalStorage()
    else:
        raise ValueError(f"Unsupported storage provider: {settings.STORAGE_PROVIDER}")
