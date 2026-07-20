import pytest
import respx
import httpx
from gateway.storage import PinataAdapter, StorageException, get_storage_adapter
from gateway.config import settings

@pytest.mark.asyncio
async def test_pinata_adapter_success():
    jwt = "test-jwt"
    endpoint = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    adapter = PinataAdapter(jwt=jwt, endpoint=endpoint)

    with respx.mock:
        respx.post(endpoint).mock(
            return_value=httpx.Response(200, json={"IpfsHash": "QmTestCID123"})
        )

        cid = await adapter.pin_file(b"test content", "test.txt")
        assert cid == "QmTestCID123"

@pytest.mark.asyncio
async def test_pinata_adapter_missing_jwt():
    adapter = PinataAdapter(jwt="", endpoint="https://api.pinata.cloud/pinning/pinFileToIPFS")
    with pytest.raises(StorageException) as excinfo:
        await adapter.pin_file(b"test content", "test.txt")
    assert excinfo.value.status_code == 502
    assert "missing" in str(excinfo.value)

@pytest.mark.asyncio
async def test_pinata_adapter_errors():
    jwt = "test-jwt"
    endpoint = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    adapter = PinataAdapter(jwt=jwt, endpoint=endpoint)

    error_cases = [
        (401, 502, "Unauthorized"),
        (400, 400, "Bad Request"),
        (415, 400, "Bad Request"),
        (429, 429, "Too Many Requests"),
        (500, 503, "Service Unavailable"),
        (503, 503, "Service Unavailable"),
    ]

    for status_in, status_out, match_str in error_cases:
        with respx.mock:
            respx.post(endpoint).mock(
                return_value=httpx.Response(status_in, text="error info")
            )
            with pytest.raises(StorageException) as excinfo:
                await adapter.pin_file(b"test content", "test.txt")
            assert excinfo.value.status_code == status_out

@pytest.mark.asyncio
async def test_pinata_adapter_network_error():
    jwt = "test-jwt"
    endpoint = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    adapter = PinataAdapter(jwt=jwt, endpoint=endpoint)

    with respx.mock:
        respx.post(endpoint).mock(side_effect=httpx.ConnectError("Connection failed"))
        with pytest.raises(StorageException) as excinfo:
            await adapter.pin_file(b"test content", "test.txt")
        assert excinfo.value.status_code == 503

def test_get_storage_adapter_factory():
    # Test local default
    settings.STORAGE_ADAPTER = "local"
    adapter = get_storage_adapter()
    assert adapter.__class__.__name__ == "LocalAdapter"

    # Test Pinata configuration
    settings.STORAGE_ADAPTER = "pinata"
    settings.PINATA_JWT = "test-jwt"
    adapter = get_storage_adapter()
    assert adapter.__class__.__name__ == "PinataAdapter"
    assert adapter.jwt == "test-jwt"
