# Research: Pinata IPFS Pinning Integration

This document contains decisions and patterns for integrating Pinata's HTTP pinning API into the IPFS Pay-to-Pin Gateway.

## Pinata API Integration Details

We will use Pinata's REST API, specifically the `pinFileToIPFS` endpoint, which supports multipart form-data uploads.

- **Endpoint**: `https://api.pinata.cloud/pinning/pinFileToIPFS`
- **Method**: `POST`
- **Auth**: Bearer token via `Authorization: Bearer <PINATA_JWT>` header.
- **Headers**:
  - `Authorization`: `Bearer <PINATA_JWT>`
- **Body**: `multipart/form-data` containing:
  - `file`: The binary content of the file.
  - `pinataMetadata` (optional): JSON to add custom metadata (like original filename).

### Decisions & Rationale

1. **Decision**: Use `httpx` or `aiohttp` for non-blocking asynchronous HTTP requests instead of synchronous `requests`.
   - **Rationale**: FastAPI is asynchronous, and using a synchronous library like `requests` would block the event loop for the duration of the upload to Pinata, degrading gateway throughput.
   - **Alternative Considered**: `requests` (rejected because it blocks asyncio loops).

2. **Decision**: Handle Pinata auth exclusively via a `PINATA_JWT` environment variable.
   - **Rationale**: JWT is the modern security standard recommended by Pinata.
   - **Alternative Considered**: API Key and API Secret headers (rejected in favor of the cleaner, single-value JWT model).

3. **Decision**: Implement a storage adapter interface (`StorageAdapter`) to facilitate mocking in tests.
   - **Rationale**: Complies with preferred guideline 6.1 (mock pinning behavior in tests without real keys or internet access).

## Error Mapping & Responses

| Pinata Status | Gateway Response | Description |
|---------------|------------------|-------------|
| 401           | 502 Bad Gateway   | Configuration / Auth issue with Pinata (logged as critical). |
| 400, 415      | 400 Bad Request   | Content issues or unsupported form payload. |
| 429           | 429 Too Many Requests | Rate limit hit on Pinata. |
| 5xx           | 503 Service Unavailable | Pinata API is down. |
