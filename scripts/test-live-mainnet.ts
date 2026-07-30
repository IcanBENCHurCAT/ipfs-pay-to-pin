import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 1x1 Grey Box PNG Image (Base64)
 */
const GREY_BOX_PNG_BASE64 = "iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const TARGET_URL = process.env.LIVE_GATEWAY_URL || "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com";

export async function runLiveMainnetTest() {
  console.log("=================================================");
  console.log("  IPFS Pay-to-Pin Live Mainnet Integration Test ");
  console.log("=================================================");
  console.log(`Target Gateway: ${TARGET_URL}`);

  // 1. Healthcheck verification
  console.log("\n[Step 1] Checking Gateway Readiness...");
  try {
    const healthRes = await axios.get(`${TARGET_URL}/ready`);
    console.log("✅ Gateway Health Status:", healthRes.data);
  } catch (err: any) {
    console.error("❌ Gateway Readiness Check Failed:", err?.message);
    return;
  }

  // 2. Submit initial pin payload (Expect 402 Payment Required)
  console.log("\n[Step 2] Requesting 402 Payment Challenge for Grey Box PNG...");
  let paymentChallengeHeader = "";
  try {
    await axios.post(`${TARGET_URL}/api/v1/pin`, {
      filename: "grey_box_live_test.png",
      data: GREY_BOX_PNG_BASE64
    });
    console.error("❌ Expected 402 Payment Required, but request succeeded unexpectedly.");
  } catch (err: any) {
    if (err.response && err.response.status === 402) {
      paymentChallengeHeader = err.response.headers["payment-required"] || err.response.headers["x402-challenge"];
      console.log("✅ Received 402 Payment Required Challenge Header:");
      console.log(paymentChallengeHeader || err.response.data);
    } else {
      console.error("❌ Unexpected Error Response:", err?.response?.data || err?.message);
      return;
    }
  }

  // 3. Dry-run guidance for Live Algorand Mainnet microUSDC Transfer
  console.log("\n[Step 3] Live Algorand Mainnet Payment Flow:");
  console.log("- Network: Algorand Mainnet (CAIP-2: algorand:mainnet)");
  console.log("- USDC Asset ID: 31566704");
  console.log("- Payee Escrow Address:", process.env.ESCROW_ADDRESS || "ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY");
  console.log("\nTo complete live settlement, attach PAYMENT-SIGNATURE header and resubmit POST /api/v1/pin.");
}

if (process.argv[1] && process.argv[1].endsWith("test-live-mainnet.ts")) {
  runLiveMainnetTest();
}
