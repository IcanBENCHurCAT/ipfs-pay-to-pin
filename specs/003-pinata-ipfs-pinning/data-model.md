# Data Model & Interfaces: Pinata IPFS Pinning Integration

This document defines the class interfaces and settings model for the Pinata Storage Adapter.

## Configuration Settings

The following environment variables configure the storage adapter:

- `STORAGE_ADAPTER`: Selection string. Supported values: `local` (simulated mock pinning) or `pinata` (active Pinata API).
- `PINATA_JWT`: Secret authorization token for Pinata API calls (required when adapter is `pinata`).
- `PINATA_ENDPOINT`: API endpoint. Defaults to `https://api.pinata.cloud/pinning/pinFileToIPFS`.

## Code Interface

```python
from abc import ABC, abstractmethod

class StorageAdapter(ABC):
    @abstractmethod
    async def pin_file(self, content: bytes, filename: str) -> str:
        """
        Uploads/pins a file and returns its IPFS CID.
        Raises an exception on failure.
        """
        pass
```

### PinataAdapter Design

```python
class PinataAdapter(StorageAdapter):
    def __init__(self, jwt: str, endpoint: str):
        self.jwt = jwt
        self.endpoint = endpoint

    async def pin_file(self, content: bytes, filename: str) -> str:
        # Sends multipart POST request to self.endpoint using httpx or aiohttp.
        # Parses response to extract the CID.
        pass
```
