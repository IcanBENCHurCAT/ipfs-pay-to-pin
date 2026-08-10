# Quickstart & Validation Guide: Multi-Chain Base & Solana Payment Expansion

**Feature Directory**: `specs/009-multichain-base-solana`  
**Created**: 2026-08-10  

---

## 1. Prerequisites & Environment Setup

Ensure the following environment variables are configured in `.env`:

```env
ALGORAND_NETWORK=mainnet
FACILITATOR_URL=https://facilitator.goplausible.xyz
ALGORAND_ESCROW_ADDRESS=YOUR_ALGO_ADDRESS
EVM_ESCROW_ADDRESS=0xYourEvmAddress
SOLANA_ESCROW_ADDRESS=YourSolanaBase58Address
PINATA_JWT=your_pinata_jwt
```

---

## 2. Automated Test Execution

Run the multi-chain test suite verifying x402 CAIP-2 header construction and signature verification mock drivers:

```bash
npm test tests/multichain.test.ts
```

---

## 3. End-to-End Validation Scenarios

### Scenario A: Verify Multi-Chain CAIP-2 Challenge (`POST /api/v1/pin`)

```bash
curl -i -X POST http://localhost:4021/api/v1/pin \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.txt", "contentBase64": "SGVsbG8gV29ybGQ="}'
```

**Expected Response**:
- Status: `HTTP/1.1 402 Payment Required`
- Header: `PAYMENT-REQUIRED` contains base64/JSON payload specifying `eip155:8453`, `solana:5ey...`, `algorand:mainnet`, and `eip155:1`.

### Scenario B: Submit Solana SPL USDC Signature

```bash
curl -i -X POST http://localhost:4021/api/v1/pin \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: {\"network\":\"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp\",\"scheme\":\"exact\",\"payload\":{\"txHash\":\"YOUR_SOLANA_TX_HASH\"}}" \
  -d '{"filename": "test.txt", "contentBase64": "SGVsbG8gV29ybGQ="}'
```

**Expected Response**:
- Status: `HTTP/1.1 201 Created`
- Body: Returns JSON containing CIDv1, `pinned_at`, and 365-day expiration metadata (`expires_at`, `ttl_days: 365`).
