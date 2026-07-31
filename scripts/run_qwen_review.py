import urllib.request
import json
import sys

prompt = """
Please perform a complete fresh review of branch `006-pinning-failure-handling` in the `ipfs-pay-to-pin` repository (latest commit: `96b9ebc`).

We have recently implemented the following fixes:
1. `src/refund.ts`: Added `algosdk.isValidAddress` recipient address validation, using v3 API (`sender`, `receiver`, `amount`, `assetIndex`, `note`, `suggestedParams`, `txid`), feature-flagged via `ENABLE_AUTOMATIC_REFUNDS`.
2. `src/queue.ts`:
   - Synchronous `isProcessing` mutex entry at the top of `processJobs()`.
   - Batch failure calculation (`consecutiveFailures`) AFTER `Promise.allSettled` completes.
   - 1GB byte capacity quota limit (`maxQueueBytes`).
   - Default synchronous Pinata pinning mode (`addJob`) vs `ALLOW_LOCAL_FALLBACK=true` feature-flagged mode.
   - Immediate local disk file deletion on failed jobs (`maxRetries = 5`).
3. `src/db.ts`: Batch Supabase upsert (`this.supabase.from('pin_records').upsert(validRecords, { onConflict: 'cid' })`).
4. `src/index.ts`:
   - Chained worker interval: `await globalFileQueue.processJobs(); await globalFileQueue.processExpiredPins();`.
   - Pricing calculation handles URL-safe Base64 (`-` -> `+`, `_` -> `/`) and strips `=` padding.
   - `circuitBreakerMiddleware` guards BOTH `/api/v1/pin` and `/api/v1/renew`.
   - HTTP security headers (`nosniff`, `DENY`, `mode=block`).
5. `src/storage.ts` & `src/cid.ts`:
   - `validateContentType()` magic byte signatures (WebP, AVIF, SVG, MP4, MP3, WAV, OGG).
   - `sanitizeFilename()` (Windows reserved names `CON/PRN/AUX/NUL/COM1-9/LPT1-9`, URL decoding).
   - `calculateLocalCid()` UnixFS v1 `dag-pb` CID generation (`bafybeic...`).

Evaluate these fixes. Are all critical, high, and medium issues resolved? Is the repository 100% READY for live mainnet testing?
Output your detailed analysis, sub-agent auditor verdict, and final status.
"""

payload = {
    "model": "nvidia/Qwen3.6-35B-A3B-NVFP4",
    "messages": [
        {"role": "system", "content": "You are a senior lead security architect and code reviewer executing a thorough audit of the IPFS Pay-to-Pin gateway on branch 006-pinning-failure-handling (commit 96b9ebc)."},
        {"role": "user", "content": prompt}
    ],
    "max_tokens": 4000,
    "temperature": 0.2
}

req = urllib.request.Request(
    "http://10.0.0.67:8000/v1/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

print("Launching Qwen 35B Review Session on DGX Spark (10.0.0.67:8000)...")
sys.stdout.flush()

try:
    with urllib.request.urlopen(req, timeout=300) as res:
        response_data = json.loads(res.read().decode("utf-8"))
        content = response_data["choices"][0]["message"]["content"]
        print("\n=== Qwen 35B Code Review Results (10.0.0.67) ===")
        print(content)
except Exception as e:
    print(f"Error querying Qwen model on 10.0.0.67: {e}")
