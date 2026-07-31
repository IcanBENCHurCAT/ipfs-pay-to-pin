import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/** 1x1 Pixel Grey Box Base64 PNG */
const TEST_FILE_BASE64 = "iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const TARGET_URL = process.env.LIVE_GATEWAY_URL || "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com";

async function runCompetitionFlowTest() {
  console.log("======================================================================");
  console.log("  Algorand x402 Global Challenge — Live Gateway Integration Test Suite ");
  console.log("======================================================================");
  console.log(`Target Service: ${TARGET_URL}\n`);

  // -------------------------------------------------------------------------
  // STEP 1: Readiness Health Check
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------------");
  console.log("[Test 1/5] Checking Gateway Readiness Endpoint (/ready)...");
  try {
    const res = await axios.get(`${TARGET_URL}/ready`);
    console.log("✅ Readiness Check Status:", res.status, res.data);
  } catch (err: any) {
    console.error("❌ Readiness Check Failed:", err?.response?.data || err?.message);
    return;
  }

  // -------------------------------------------------------------------------
  // STEP 2: Submit File Upload Request (Expect HTTP 402 Payment Challenge)
  // -------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------------------");
  console.log("[Test 2/5] Requesting HTTP 402 Challenge for 'grey_box_demo.png'...");
  let challengeHeader = "";
  try {
    await axios.post(`${TARGET_URL}/api/v1/pin`, {
      filename: "grey_box_demo.png",
      data: TEST_FILE_BASE64
    });
    console.error("❌ Expected 402 Payment Required, but received 200 OK!");
  } catch (err: any) {
    if (err.response && err.response.status === 402) {
      challengeHeader = err.response.headers["payment-required"] || err.response.headers["x402-challenge"];
      console.log("✅ Successfully received HTTP 402 Payment Required!");
      console.log("Raw Challenge Header (Base64):", challengeHeader);

      try {
        const decodedStr = Buffer.from(challengeHeader, 'base64').toString('utf8');
        const decodedJson = JSON.parse(decodedStr);
        console.log("\nDecoded x402 Challenge Details:");
        console.log(`- Resource URL: ${decodedJson.resource?.url}`);
        console.log(`- Algorand Network: ${decodedJson.accepts?.[0]?.network}`);
        console.log(`- microUSDC Amount: ${decodedJson.accepts?.[0]?.amount} (ASA ID: ${decodedJson.accepts?.[0]?.asset})`);
        console.log(`- Escrow Recipient: ${decodedJson.accepts?.[0]?.payTo}`);
      } catch (e) {
        console.log("Note: Could not parse header as JSON string");
      }
    } else {
      console.error("❌ Unexpected Error Response:", err?.response?.status, err?.response?.data || err?.message);
      return;
    }
  }

  // -------------------------------------------------------------------------
  // STEP 3: Edge Case Test — Attempting to Renew Non-Existent / Unpinned CID
  // -------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------------------");
  console.log("[Test 3/5] Edge Case: Renewing Non-Existent CID (bafybeigbogus9999999)...");
  try {
    await axios.post(`${TARGET_URL}/api/v1/renew`, {
      cid: "bafybeigbogus999999999999999999999999999999999999999999"
    });
    console.error("❌ Expected 404/410 Error for bogus CID, but request succeeded!");
  } catch (err: any) {
    if (err.response && (err.response.status === 404 || err.response.status === 410)) {
      console.log(`✅ Correctly Rejected Unpinned/Bogus CID with HTTP ${err.response.status}!`);
      console.log("Response Body:", err.response.data);
    } else if (err.response && err.response.status === 402) {
      console.log("ℹ️ Received 402 challenge for renewal request (expected before CID validation).");
    } else {
      console.warn("⚠️ Response:", err?.response?.status, err?.response?.data || err?.message);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 4: Edge Case Test — Querying Free Retention Status for Non-Existent CID
  // -------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------------------");
  console.log("[Test 4/5] Edge Case: Free Status Lookup for Non-Existent CID (/api/v1/pin/bafybeigbogus9999)...");
  try {
    await axios.get(`${TARGET_URL}/api/v1/pin/bafybeigbogus999999999999999999999999999999999999999999`);
    console.error("❌ Expected HTTP 404 Not Found, but request succeeded!");
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      console.log("✅ Correctly Returned HTTP 404 Not Found for non-existent CID status query!");
      console.log("Response Body:", err.response.data);
    } else {
      console.warn("⚠️ Response:", err?.response?.status, err?.response?.data || err?.message);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 5: Live Payment Instructions & Demo Summary
  // -------------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("  Live On-Chain Settlement Verification Instructions ");
  console.log("======================================================================");
  console.log("To complete full end-to-end on-chain pinning & renewal testing:\n");
  console.log("1. Pay microUSDC (10,020 microUSDC / 0.010020 USDC) to Escrow Address:");
  console.log("   ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY");
  console.log("\n2. Submit payment signature header on POST /api/v1/pin:");
  console.log("   PAYMENT-SIGNATURE: <TRANSACTION_ID_OR_SIGNATURE>");
  console.log("\n3. Inspect returned CID via free status endpoint:");
  console.log("   GET /api/v1/pin/<RETURNED_CID>");
  console.log("\n4. Test 50% Early Renewal on active CID:");
  console.log("   POST /api/v1/renew with JSON { \"cid\": \"<RETURNED_CID>\" }\n");
  console.log("======================================================================");
}

runCompetitionFlowTest();
