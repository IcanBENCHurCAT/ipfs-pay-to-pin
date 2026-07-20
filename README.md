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

