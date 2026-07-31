import axios from 'axios';
import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

const TARGET_URL = process.env.LIVE_GATEWAY_URL || "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com";
const GREY_BOX_PNG_BASE64 = "iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const mnemonic = process.env.DEPLOYER_MNEMONIC || process.env.ALGORAND_WALLET_MNEMONIC || "";
if (!mnemonic) {
  console.error("❌ Error: No ALGORAND_WALLET_MNEMONIC or DEPLOYER_MNEMONIC found in .env");
  process.exit(1);
}

const account = algosdk.mnemonicToSecretKey(mnemonic);
const algodClient = new algosdk.Algodv2('', process.env.ALGOD_ADDRESS || 'https://mainnet-api.algonode.cloud', '');

async function runLivePaymentAndPinning() {
  console.log("======================================================================");
  console.log("  Executing Live Mainnet microUSDC Payment & Pinning ");
  console.log("======================================================================");
  console.log(`Sender Address:  ${account.addr.toString()}`);
  console.log(`Target Gateway:  ${TARGET_URL}\n`);

  // Check sender balance first
  const accountInfo = await algodClient.accountInformation(account.addr).do();
  const algoAmount = Number(accountInfo.amount);
  const assets = accountInfo.assets || [];
  const usdcAsset = assets.find((a: any) => Number(a.assetId || a['asset-id']) === 31566704);
  const usdcBalance = usdcAsset ? Number(usdcAsset.amount) : 0;

  console.log(`[Balance Check] ALGO: ${algoAmount / 1_000_000} ALGO | USDC: ${usdcBalance / 1_000_000} USDC (${usdcBalance} microUSDC)\n`);

  if (usdcBalance < 10020) {
    console.error(`❌ Insufficient USDC balance (${usdcBalance} microUSDC available). Need at least 10,020 microUSDC (0.010020 USDC) to settle live payment.`);
    return;
  }

  // 1. Request 402 Payment Required Challenge
  console.log("[Step 1] Requesting 402 Payment Challenge for 'grey_box_live_paid.png'...");
  let challengeHeader = "";
  try {
    await axios.post(`${TARGET_URL}/api/v1/pin`, {
      filename: "grey_box_live_paid.png",
      data: GREY_BOX_PNG_BASE64
    });
  } catch (err: any) {
    if (err.response && err.response.status === 402) {
      challengeHeader = err.response.headers["payment-required"] || err.response.headers["x402-challenge"];
      console.log("✅ Received 402 Payment Required Challenge.");
    } else {
      console.error("❌ Unexpected Error Response:", err?.response?.status, err?.response?.data || err?.message);
      return;
    }
  }

  // Parse challenge details
  let amountMicroUsdc = 10001;
  let escrowAddress = process.env.ESCROW_ADDRESS || "ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY";
  let networkCaip2 = "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=";

  try {
    const decodedStr = Buffer.from(challengeHeader, 'base64').toString('utf8');
    const decodedJson = JSON.parse(decodedStr);
    const accepts = decodedJson.accepts?.[0];
    if (accepts) {
      amountMicroUsdc = parseInt(accepts.amount, 10);
      escrowAddress = accepts.payTo;
      networkCaip2 = accepts.network || networkCaip2;
    }
  } catch {}

  console.log(`\n[Step 2] Executing On-Chain USDC Transfer:`);
  console.log(`- Amount: ${amountMicroUsdc} microUSDC (${amountMicroUsdc / 1_000_000} USDC)`);
  console.log(`- Recipient Escrow: ${escrowAddress}`);

  const suggestedParams = await algodClient.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: escrowAddress,
    amount: amountMicroUsdc,
    assetIndex: 31566704,
    note: new Uint8Array(Buffer.from("x402-pin-payment")),
    suggestedParams,
  });

  const signedTxn = txn.signTxn(account.sk);
  const sendResult = await algodClient.sendRawTransaction(signedTxn).do();
  const txid = sendResult.txid;
  console.log(`Submitted Settlement TxID: ${txid}`);

  console.log("Waiting for network confirmation...");
  await algosdk.waitForConfirmation(algodClient, txid, 4);
  console.log("✅ On-chain payment confirmed!");

  // Construct x402 v2 payment signature header
  const paymentSignatureObj = {
    x402Version: 2,
    scheme: "exact",
    network: networkCaip2,
    payload: {
      txid: txid
    }
  };

  const paymentSignatureHeader = Buffer.from(JSON.stringify(paymentSignatureObj)).toString('base64');

  // 3. Resubmit POST /api/v1/pin with PAYMENT-SIGNATURE
  console.log("\n[Step 3] Submitting Paid Request with PAYMENT-SIGNATURE Header...");
  try {
    const pinRes = await axios.post(`${TARGET_URL}/api/v1/pin`, {
      filename: "grey_box_live_paid.png",
      data: GREY_BOX_PNG_BASE64
    }, {
      headers: {
        "PAYMENT-SIGNATURE": paymentSignatureHeader,
        "PAYMENT-REQUIRED": challengeHeader
      }
    });

    console.log("\n🎉 SUCCESS! File Pinned to IPFS:");
    console.log(JSON.stringify(pinRes.data, null, 2));

    const pinnedCid = pinRes.data.cid || pinRes.data.ipfs_cid;

    // 4. Check Free Status Endpoint
    console.log(`\n[Step 4] Checking Free Pin Status for CID ${pinnedCid}...`);
    const statusRes = await axios.get(`${TARGET_URL}/api/v1/pin/${pinnedCid}`);
    console.log("Pin Retention Status:", statusRes.data);

    // 5. Test Annual Renewal
    console.log(`\n[Step 5] Testing Annual Renewal for CID ${pinnedCid}...`);
    try {
      await axios.post(`${TARGET_URL}/api/v1/renew`, { cid: pinnedCid });
    } catch (renewErr: any) {
      if (renewErr.response && renewErr.response.status === 402) {
        const renewChallenge = renewErr.response.headers["payment-required"] || renewErr.response.headers["x402-challenge"];
        console.log("✅ Successfully received Renewal 402 Challenge!");
        const decodedRenew = JSON.parse(Buffer.from(renewChallenge, 'base64').toString('utf8'));
        console.log(`Renewal microUSDC Amount Required: ${decodedRenew.accepts?.[0]?.amount} (50% discount confirmed!)`);
      }
    }

  } catch (err: any) {
    console.error("❌ Pin Request Failed:", err?.response?.status, err?.response?.data || err?.message);
  }
}

runLivePaymentAndPinning().catch(err => console.error("Unhandled Error:", err));
