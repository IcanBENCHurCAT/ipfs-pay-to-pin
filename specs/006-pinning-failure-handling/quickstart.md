# Quickstart: Pinning Failure Handling Validation

## Prerequisites
- Node.js installed
- Gateway running (`npm run dev`)
- A valid x402 payment client (or mock utility)

## Scenario 1: Test Circuit Breaker
1. **Setup**: Stop the background worker (or temporarily modify `src/storage.ts` to skip processing) and push dummy files into the `queue/` directory until it exceeds `MAX_QUEUE_ITEMS`.
2. **Execute**: Send a `POST /api/v1/pin` request to the gateway.
3. **Verify**: The server should immediately return a `503 Service Unavailable` error: `{"error": "Service temporarily unavailable. Storage queue is at capacity."}`. No 402 challenge should be returned.

## Scenario 2: Test Async Buffer Queue
1. **Setup**: Turn off your internet connection, or change the `PINATA_JWT` to an invalid string so the Pinata API fails. Ensure the queue is empty.
2. **Execute**: Send a `POST /api/v1/pin` request with a valid `PAYMENT-SIGNATURE` header.
3. **Verify**: The server should return `201 Created` immediately, along with a locally generated mock `ipfs_cid` or a "pending" status indicating the file is buffered.
4. **Follow-up**: Restore the `PINATA_JWT` or internet connection. Observe the background worker logs to see it successfully pick up the buffered file and pin it to Pinata on the next polling cycle.
