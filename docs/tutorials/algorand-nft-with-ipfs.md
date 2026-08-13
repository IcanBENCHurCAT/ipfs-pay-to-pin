# 🎨 Creating Automated NFTs on Algorand with IPFS Metadata

**Tutorial**: Craft NFTs (ASAs) on the Algorand blockchain with metadata stored on IPFS via our pay-to-pin client SDK — no Pinata account required.

---

## What You'll Build

A complete workflow that:
1. Creates NFT metadata (JSON) locally
2. Pins it to IPFS using the ipfs-pay-to-pin-client SDK (pay-to-pin service)
3. Creates an ASA on Algorand with the IPFS CID attached
4. The result: a self-contained NFT where metadata is permanently stored on IPFS via micropayments, no centralized pinning service needed

---

## Prerequisites

- Python 3.12+
- Algorand wallet (get testnet ALGO from [Algorand TestNet faucet](https://bank.testnet.algor.network/))
- [py-algorand-sdk](https://github.com/algorand/py-algorand-sdk) installed
- ipfs-pay-to-pin-client SDK installed

```bash
pip install algosdk ipfs-pay-to-pin-client
```

---

## Step 1: Understanding the Components

### Algorand ASA (Algorand Standard Asset)

An ASA is Algorand's token standard. For NFTs we use:
- `total = 1` (only one copy)
- `decimals = 0` (indivisible)
- `url` field: IPFS CID where metadata lives
- `metadata_hash`: SHA-512/256 hash of the CID (32 bytes)

### ipfs-pay-to-pin-client SDK

Our client SDK handles:
- Uploading data to IPFS via a pay-to-pin gateway
- x402 micropayment processing (automatic USDC payment)
- Multi-chain support (Algorand, Base L2, Solana, Ethereum L1)
- No Pinata, Infura, or Pinata account needed — the gateway handles storage

---

## Step 2: The Complete NFT Creation Script

Create a file called `create_nft.py`:

```python
#!/usr/bin/env python3
"""
Create an NFT on Algorand with IPFS metadata via ipfs-pay-to-pin-client.

Workflow:
  1. Create NFT metadata JSON locally
  2. Upload metadata to IPFS via pay-to-pin gateway (x402 auto-payment)
  3. Create ASA on Algorand with CID attached as URL and metadata_hash
"""

import json
import hashlib
import base64

from algosdk import account, transaction, util, future
from algosdk.v2client import algod
from ipfs_pay_to_pin_client import IpfsPayToPinClient, PinResponse


# ============================================================
# CONFIGURATION
# ============================================================

# Algorand testnet (swap to mainnet for production)
ALGOD_NODE = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""  # empty for testnet

# Your Algorand wallet mnemonic (REMEMBER: never commit this!)
WALLET_MNEMONIC = "your 25-word mnemonic phrase here"

# NFT details
NFT_NAME = "MyFirstIPFSNFT"          # Display name of the NFT
UNIT_NAME = "IPNFT"                   # Ticker symbol
NFT_DESCRIPTION = "An NFT with metadata pinned via ipfs-pay-to-pin-client"
NFT_IMAGE_URL = "https://example.com/nft.png"  # Optional: link to image

# Pay-to-pin gateway (our service — no API key needed)
PAY_TO_PIN_GATEWAY = "https://pay-to-pin.duckdns.org"

# ============================================================
# STEP 1: Create NFT Metadata
# ============================================================

def create_nft_metadata(name, unit_name, description, image_url, attributes=None):
    """Create NFT metadata as a JSON object."""
    metadata = {
        "name": name,
        "description": description,
        "image": image_url,
        "attributes": attributes or [
            {"trait_type": "Type", "value": "Digital Art"},
            {"trait_type": "Network", "value": "Algorand"},
            {"trait_type": "Storage", "value": "IPFS via pay-to-pin"}
        ],
        "external_url": f"https://example.com/nft/{unit_name}"
    }
    return metadata


# ============================================================
# STEP 2: Pin Metadata to IPFS via ipfs-pay-to-pin-client SDK
# ============================================================

def pin_metadata_to_ipfs(metadata, sender_mnemonic, gateway_url=PAY_TO_PIN_GATEWAY):
    """
    Upload NFT metadata to IPFS using the pay-to-pin service.
    
    Returns: PinResponse with the IPFS CID
    """
    # Initialize the client with your Algorand wallet
    client = IpfsPayToPinClient(
        gateway_url=gateway_url,
        sender_mnemonic=sender_mnemonic,
        preferred_network="algorand:mainnet"  # Pay with Algorand USDC
    )
    
    # Convert metadata dict to JSON bytes
    metadata_bytes = json.dumps(metadata, indent=2).encode("utf-8")
    
    # Pin to IPFS — the SDK handles x402 payment automatically!
    # No Pinata account needed, no API key, no upfront setup
    pin_response: PinResponse = client.pin_bytes(
        data=metadata_bytes,
        filename="nft-metadata.json"
    )
    
    print(f"✅ Metadata pinned to IPFS!")
    print(f"   CID: {pin_response.cid}")
    print(f"   Status: {pin_response.status}")
    print(f"   Pin expires: {pin_response.pin_expires_at}")
    print(f"   TX ID: {pin_response.tx_id}")
    
    return pin_response


# ============================================================
# STEP 3: Create ASA with CID Attached
# ============================================================

def create_asa_with_cid(algod_client, sender_mnemonic, cid, nft_name, unit_name, nft_url):
    """
    Create an ASA (NFT) on Algorand with the IPFS CID attached.
    
    The CID is stored in two places:
      1. url field: The IPFS gateway URL (ipfs://<cid>)
      2. metadata_hash: SHA-512/256 hash of the CID (32 bytes)
    """
    
    # Derive address from mnemonic
    private_key = account.private_key_from_mnemonic(sender_mnemonic)
    sender_address = account.address_from_private_key(private_key)
    
    # Get suggested transaction parameters
    sp = algod_client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000  # 1000 microAlgos (minimum fee)
    
    # Create the 32-byte metadata hash from the CID
    # IPFS CIDs are typically 46 chars (base58), but we hash them
    cid_bytes = cid.encode("utf-8")
    metadata_hash = hashlib.sha512_256(cid_bytes).digest()  # 32 bytes
    
    print(f"\n📝 Metadata hash: {metadata_hash.hex()}")
    
    # Build ASA creation transaction
    # For NFTs: total=1, decimals=0, all permissions on sender (self-controlled)
    asa_txn = transaction.AssetConfigTxn(
        sender=sender_address,
        sp=sp,
        index=0,  # 0 means create new asset
        total=1,                    # Only 1 copy (NFT!)
        default_frozen=False,
        unit_name=unit_name,        # Ticker: e.g. "IPNFT"
        asset_name=nft_name,        # Display name: e.g. "MyFirstIPFSNFT"
        manager=sender_address,     # Can re-mint/upgrade (you)
        reserve=sender_address,     # Reserve address (you)
        freeze=sender_address,      # Can freeze/unfreeze (you)
        clawback=sender_address,    # Can clawback tokens (you)
        url=f"ipfs://{cid}",        # IPFS gateway URL to metadata
        metadata_hash=metadata_hash,  # 32-byte hash of CID
        decimals=0                  # Indivisible (NFT)
    )
    
    # Sign the transaction
    signed_txn = asa_txn.sign(private_key)
    
    print(f"\n📤 Transaction ID: {signed_txn.transaction.get_txid()}")
    print(f"   Asset name: {nft_name}")
    print(f"   Unit name: {unit_name}")
    print(f"   IPFS CID: {cid}")
    
    return signed_txn


# ============================================================
# STEP 4: Submit and Confirm
# ============================================================

def submit_transaction(algod_client, signed_txn):
    """Submit transaction to Algorand network and wait for confirmation."""
    
    # Send transaction
    tx_id = signed_txn.transaction.get_txid()
    algod_client.send_transactions([signed_txn])
    
    print(f"\n⏳ Waiting for confirmation...")
    
    # Wait for confirmation (poll up to 30 seconds)
    for i in range(30):
        try:
            tx_info = algod_client.pending_transaction_info(tx_id)
            if tx_info.get("confirmed-round", 0) > 0:
                asset_id = tx_info.get("asset-index", 0)
                print(f"✅ NFT created on Algorand!")
                print(f"   Asset ID: {asset_id}")
                print(f"   Confirmed in round: {tx_info['confirmed-round']}")
                print(f"   Transaction: https://allo.dev/tx/{tx_id}")
                return asset_id
        except Exception as e:
            print(f"   ... still waiting ({i+1}/30)")
        
        import time
        time.sleep(1)
    
    raise TimeoutError("Transaction not confirmed after 30 seconds")


# ============================================================
# MAIN EXECUTION
# ============================================================

def main():
    print("=" * 60)
    print("🎨 NFT Creation: Algorand ASA + IPFS Metadata")
    print("=" * 60)
    
    # 1️⃣ Initialize Algorand client
    print("\n📡 Connecting to Algorand TestNet...")
    algod_client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_NODE)
    
    # 2️⃣ Create NFT metadata
    print("\n📝 Creating NFT metadata...")
    metadata = create_nft_metadata(
        name=NFT_NAME,
        unit_name=UNIT_NAME,
        description=NFT_DESCRIPTION,
        image_url=NFT_IMAGE_URL
    )
    print(f"   {json.dumps(metadata, indent=2)}")
    
    # 3️⃣ Pin to IPFS via pay-to-pin SDK
    print("\n📌 Uploading to IPFS via pay-to-pin gateway...")
    pin_response = pin_metadata_to_ipfs(
        metadata=metadata,
        sender_mnemonic=WALLET_MNEMONIC
    )
    
    # 4️⃣ Create ASA with CID
    print("\n🪙 Creating ASA on Algorand...")
    signed_txn = create_asa_with_cid(
        algod_client=algod_client,
        sender_mnemonic=WALLET_MNEMONIC,
        cid=pin_response.cid,
        nft_name=NFT_NAME,
        unit_name=UNIT_NAME,
        nft_url=f"ipfs://{pin_response.cid}"
    )
    
    # 5️⃣ Submit and confirm
    print("\n🚀 Submitting transaction...")
    asset_id = submit_transaction(algod_client, signed_txn)
    
    print("\n" + "=" * 60)
    print("🎉 NFT COMPLETE!")
    print("=" * 60)
    print(f"   Asset ID: {asset_id}")
    print(f"   IPFS CID: {pin_response.cid}")
    print(f"   Metadata: ipfs://{pin_response.cid}")
    print(f"   Explorer: https://allo.dev/asset/{asset_id}")


if __name__ == "__main__":
    main()
```

---

## Step 3: Running the Tutorial

### Option A: TestNet (Recommended)

1. Get testnet ALGO: [Algorand TestNet Faucet](https://bank.testnet.algor.network/)
2. Replace `WALLET_MNEMONIC` with your testnet wallet mnemonic
3. Run:

```bash
python3 create_nft.py
```

**Expected output:**
```
============================================================
🎨 NFT Creation: Algorand ASA + IPFS Metadata
============================================================

📡 Connecting to Algorand TestNet...

📝 Creating NFT metadata...
   {
     "name": "MyFirstIPFSNFT",
     "description": "An NFT with metadata pinned via ipfs-pay-to-pin-client",
     "image": "https://example.com/nft.png",
     ...
   }

📌 Uploading to IPFS via pay-to-pin gateway...
✅ Metadata pinned to IPFS!
   CID: QmYwAPJzv5CZsn4... (actual CID here)
   Status: pinned
   Pin expires: 2027-08-12T00:00:00Z
   TX ID: <x402 payment tx>

🪙 Creating ASA on Algorand...
📝 Metadata hash: a1b2c3d4...

📤 Transaction ID: <txn-id>
   Asset name: MyFirstIPFSNFT
   Unit name: IPNFT
   IPFS CID: QmYwAPJzv5CZsn4...

🚀 Submitting transaction...
⏳ Waiting for confirmation...
✅ NFT created on Algorand!
   Asset ID: 12345678
   Confirmed in round: 12345678
   Transaction: https://allo.dev/tx/<txn-id>

🎉 NFT COMPLETE!
============================================================
   Asset ID: 12345678
   IPFS CID: QmYwAPJzv5CZsn4...
   Metadata: ipfs://QmYwAPJzv5CZsn4...
   Explorer: https://allo.dev/asset/12345678
```

### Option B: MainNet (Production)

Change `ALGOD_NODE` to:
```python
ALGOD_NODE = "https://mainnet-api.algonode.cloud"
```

And use your mainnet wallet mnemonic. Make sure you have enough ALGO for:
- ASA creation fee (~1 ALGO deposit)
- IPFS pinning cost (paid via x402 micropayment)
- Transaction fee (1000 microAlgos)

---

## Step 4: How It Works

### The Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Create NFT Metadata (JSON)                               │
│     - name, description, image URL, attributes               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  2. ipfs-pay-to-pin-client SDK                              │
│     - Encodes metadata to JSON bytes                         │
│     - Sends to pay-to-pin gateway via HTTP POST              │
│     - Gateway returns x402 challenge (402 Payment Required)  │
│     - SDK auto-signs payment (Algorand/ETH/Solana)           │
│     - Gateway stores content on IPFS permanently             │
│     - Returns: { cid: "Qm...", status: "pinned" }           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Create ASA on Algorand                                   │
│     - CID stored in ASA.url field (ipfs://<cid>)             │
│     - SHA-512/256 hash stored in ASA.metadata_hash           │
│     - total=1, decimals=0 (NFT)                              │
│     - All permissions on sender wallet                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Result: Self-Contained NFT                              │
│     - ASA ID on Algorand blockchain                          │
│     - Metadata permanently on IPFS via pay-to-pin            │
│     - Anyone can verify:                                     │
│       1. Check ASA metadata via Algorand explorer            │
│       2. Fetch metadata from: ipfs://<cid>                   │
│       3. No Pinata account, no API key, no centralized       │
└─────────────────────────────────────────────────────────────┘
```

### Why This Matters

**Without our SDK (traditional approach):**
1. Create Pinata account → wait for approval
2. Get API key → configure client
3. Upload metadata → pay monthly subscription
4. If you stop paying → metadata unpinning → lost forever

**With our SDK (pay-to-pin):**
1. Get Algorand wallet → done ✅
2. Create metadata → done ✅
3. Upload to IPFS → automatic x402 micropayment ✅
4. Metadata pinned permanently → no account needed ✅

---

## Step 5: Advanced — Bulk NFT Creation

For creating multiple NFTs efficiently:

```python
def create_bulk_nfts(metadata_list, sender_mnemonic, algod_client):
    """Create multiple NFTs in a batch."""
    
    client = IpfsPayToPinClient(
        gateway_url=PAY_TO_PIN_GATEWAY,
        sender_mnemonic=sender_mnemonic,
        preferred_network="algorand:mainnet"
    )
    
    pin_responses = []
    transactions = []
    
    for i, meta in enumerate(metadata_list):
        # Pin metadata
        pin_resp = client.pin_bytes(
            data=json.dumps(meta).encode(),
            filename=f"nft-{i+1}.json"
        )
        pin_responses.append(pin_resp)
        
        # Create ASA transaction (don't send yet)
        private_key = account.private_key_from_mnemonic(sender_mnemonic)
        sp = algod_client.suggested_params()
        sp.flat_fee = True
        
        cid_bytes = pin_resp.cid.encode("utf-8")
        metadata_hash = hashlib.sha512_256(cid_bytes).digest()
        
        txn = transaction.AssetConfigTxn(
            sender=account.address_from_private_key(private_key),
            sp=sp,
            index=0,
            total=1,
            unit_name=f"IPNFT{i+1}",
            asset_name=meta["name"],
            manager=account.address_from_private_key(private_key),
            reserve=account.address_from_private_key(private_key),
            freeze=account.address_from_private_key(private_key),
            clawback=account.address_from_private_key(private_key),
            url=f"ipfs://{pin_resp.cid}",
            metadata_hash=metadata_hash,
            decimals=0
        )
        
        signed = txn.sign(private_key)
        transactions.append(signed)
    
    # Send all transactions in one batch
    algod_client.send_transactions(transactions)
    
    print(f"✅ Created {len(transactions)} NFTs!")
    for i, resp in enumerate(pin_responses):
        print(f"  NFT {i+1}: CID={resp.cid}, TX={transactions[i].transaction.get_txid()}")
    
    return pin_responses
```

---

## Step 6: Verifying Your NFT

After creation, verify everything is connected:

```python
def verify_nft(asset_id, cid, algod_client):
    """Verify that the ASA metadata matches the IPFS CID."""
    
    # 1. Get ASA info from Algorand
    asset_info = algod_client.get_asset_by_id(asset_id)
    
    print(f"ASA Metadata:")
    print(f"  Name: {asset_info['params']['name']}")
    print(f"  Unit: {asset_info['params']['unit-name']}")
    print(f"  URL: {asset_info['params']['url']}")
    print(f"  Metadata Hash: {asset_info['params']['metadata-hash']}")
    
    # 2. Check URL matches CID
    expected_url = f"ipfs://{cid}"
    if asset_info['params']['url'] == expected_url:
        print(f"\n✅ URL matches CID: {cid}")
    else:
        print(f"\n❌ URL mismatch!")
        print(f"   Expected: {expected_url}")
        print(f"   Got: {asset_info['params']['url']}")
    
    # 3. Verify metadata hash
    metadata_hash = hashlib.sha512_256(cid.encode()).digest()
    if asset_info['params']['metadata-hash'] == metadata_hash.hex():
        print(f"✅ Metadata hash verified!")
    else:
        print(f"❌ Metadata hash mismatch!")


# Usage:
verify_nft(asset_id=12345678, cid="QmYwAPJzv5CZsn4...", algod_client=algod_client)
```

---

## Troubleshooting

### Issue: "Payment Required (402)" error

**Cause:** The x402 gateway returned a payment challenge.

**Solution:** This is normal! The SDK automatically handles the payment. Make sure you provided a valid `sender_mnemonic` with sufficient balance.

### Issue: "InsufficientFundsError"

**Cause:** Your Algorand wallet doesn't have enough ALGO for:
- ASA creation (1 ALGO deposit, refundable)
- Transaction fees
- IPFS pinning cost (x402 micropayment)

**Solution:** Get testnet ALGO from [the faucet](https://bank.testnet.algor.network/) or fund your mainnet wallet.

### Issue: "PinningFailedError"

**Cause:** The pay-to-pin gateway rejected the upload.

**Solution:** Check that:
1. Metadata is valid JSON
2. File size is under gateway limits
3. Network connectivity is working

### Issue: "Transaction not confirmed"

**Cause:** Algorand network congestion or insufficient fee.

**Solution:** 
1. Increase fee: `sp.fee = 2000` or higher
2. Use `flat_fee=True`
3. Check [Algorand status](https://status.algonode.cloud/)

---

## What You've Learned

✅ How to create NFT metadata (JSON format)  
✅ How to pin metadata to IPFS using the ipfs-pay-to-pin-client SDK  
✅ How x402 micropayments work automatically  
✅ How to create an ASA on Algorand with CID attached  
✅ How to verify the connection between ASA and IPFS  
✅ How to do all this without a Pinata or Pinata-like account  

---

## Next Steps

- **Bulk minting:** Use the bulk NFT creation pattern above
- **Automated pipelines:** Integrate with CI/CD to mint on trigger
- **Marketplace integration:** List on AlgoFinder, DotALGO, or AlgoAssets
- **Royalties:** Add ASA parameters for creator fee splits
- **Multi-chain:** Use the SDK's multi-chain support to pin from Base, Solana, or Ethereum wallets too

---

## Resources

- [ipfs-pay-to-pin-client SDK](https://github.com/IcanBENCHurCAT/ipfs-pay-to-pin)
- [PyPI: ipfs-pay-to-pin-client](https://pypi.org/project/ipfs-pay-to-pin-client/)
- [NPM: ipfs-pay-to-pin-client](https://www.npmjs.com/package/ipfs-pay-to-pin-client)
- [Algorand ASA Documentation](https://developer.algorand.org/docs/get-details/dapps/avm/asn/)
- [Algorand TestNet Faucet](https://bank.testnet.algor.network/)
- [Allo.dev Explorer](https://allo.dev/)

---

**No Pinata. No API keys. No subscriptions. Just IPFS + Algorand + x402.** 🎉
