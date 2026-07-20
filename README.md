# IPFS Pay-to-Pin Gateway

A lightweight, pay-per-request API endpoint that pins files to IPFS upon receiving an Algorand x402 (Payment Required) micropayment. 

## Overview
This service allows developers, dApps, and creators to upload and pin files directly to IPFS without needing centralized API keys, subscriptions, or credit cards. The API operates under the HTTP `402 Payment Required` standard.

1. **Upload Request**: Client sends a file to `POST /api/v1/pin`.
2. **x402 Challenge**: The server calculates the cost based on file size, pins the file temporarily, and responds with `402 Payment Required`, including the target payment address (escrow), amount in microALGOs, and transaction reference.
3. **Payment & Release**: Client submits the signed transaction/payment to the Algorand blockchain and provides the transaction ID to the server.
4. **Verification & Permanent Pin**: The gateway verifies the transaction on-chain, secures the file permanently on IPFS, and returns the IPFS Gateway CID.

## Tech Stack
- **Backend**: Python 3.12+, FastAPI, `py-algorand-sdk`
- **Smart Contract**: Algorand Python (`algopy`)
- **Decentralized Storage**: IPFS (via Pinata / local IPFS node)
- **Testing**: Pytest, local sandbox verification

## Configuration

The gateway can be configured using environment variables (or a `.env` file):

- `STORAGE_ADAPTER`: Choose between `local` (simulated pinning, default) and `pinata` (production pinning via Pinata).
- `PINATA_JWT`: Your Pinata JWT authorization token (required if `STORAGE_ADAPTER=pinata`).
- `PINATA_ENDPOINT`: Pinata API endpoint (defaults to `https://api.pinata.cloud/pinning/pinFileToIPFS`).
- `DATABASE_PATH`: File path for the persistent SQLite database (defaults to `gateway.db`).
- `ALGOD_ADDRESS`: The URL of the primary Algod node provider (defaults to `http://localhost:4001`).
- `ALGOD_TOKEN`: The API token for the primary Algod node provider.
- `ALGOD_FALLBACK_ADDRESSES`: A comma-separated list of fallback Algod node provider URLs to query in case of high availability / rate limit recovery.

## Database Structure

The gateway uses SQLite to persist state across service restarts.

### 1. `processed_transactions` Table
Tracks successfully verified on-chain payments to prevent double-spend attacks:
- `txn_id` (TEXT, Primary Key): The 52-character base32 Algorand transaction ID.
- `sender` (TEXT): Wallet address of the payer.
- `receiver` (TEXT): Escrow address of the gateway.
- `amount` (INTEGER): Amount paid in microALGOs.
- `reference_id` (TEXT): The unique reference ID generated during the x402 challenge.
- `timestamp` (TEXT): ISO 8601 UTC timestamp when recorded.

### 2. `verification_challenges` Table
Stores challenge statuses and expiration details:
- `reference_id` (TEXT, Primary Key): Unique challenge identifier.
- `expected_amount` (INTEGER): Expected microALGO fee.
- `escrow_address` (TEXT): Destination address.
- `status` (TEXT): Status of the challenge (`PENDING`, `VERIFIED`, `REJECTED`, `EXPIRED`).
- `expires_at` (TEXT): ISO 8601 UTC expiration timestamp.


