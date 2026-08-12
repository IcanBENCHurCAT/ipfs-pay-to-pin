# Multi-Chain x402 Header Contracts & API Specification

**Feature Directory**: `specs/009-multichain-base-solana`  
**Created**: 2026-08-10  

---

## HTTP `402 Payment Required` Header Schema

```json
{
  "x402": {
    "version": "2.0",
    "accepts": [
      {
        "network": "eip155:8453",
        "scheme": "exact",
        "price": "12000",
        "payTo": "0xEscrowAddress...",
        "extra": {
          "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "eip3009": true
        }
      },
      {
        "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        "scheme": "exact",
        "price": "12000",
        "payTo": "SolanaEscrowBase58Address...",
        "extra": {
          "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        }
      },
      {
        "network": "algorand:mainnet",
        "scheme": "exact",
        "price": "12000",
        "payTo": "ALGORAND_ESCROW_ADDRESS",
        "extra": {
          "asset": 31566704
        }
      },
      {
        "network": "eip155:1",
        "scheme": "exact",
        "price": "2512000",
        "maxTimeoutSeconds": 90,
        "payTo": "0xEscrowAddress...",
        "extra": {
          "asset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        }
      }
    ]
  }
}
```

---

## Client `PAYMENT-SIGNATURE` Header Contracts

### EVM Base L2 EIP-3009 Permit Signature Header
```json
{
  "network": "eip155:8453",
  "scheme": "exact",
  "payload": {
    "authorization": {
      "from": "0xClientAddress...",
      "to": "0xEscrowAddress...",
      "value": "12000",
      "validAfter": 0,
      "validBefore": 1770000000,
      "nonce": "0x1234...",
      "v": 27,
      "r": "0xa1b2...",
      "s": "0xc3d4..."
    }
  }
}
```

### Solana SPL USDC Pre-broadcasted Signature Hash Header
```json
{
  "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "scheme": "exact",
  "payload": {
    "txHash": "5K...solanaTxSignatureBase58..."
  }
}
```
