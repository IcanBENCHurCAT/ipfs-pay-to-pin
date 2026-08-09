import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactAvmScheme, toClientAvmSigner, ALGORAND_MAINNET_CAIP2 } from '@x402/avm';
import algosdk from 'algosdk';
import axios from 'axios';
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

async function runOfficialX402Payment() {
  console.log("======================================================================");
  console.log("  Executing Official @x402/hono Mainnet microUSDC Payment & Pinning ");
  console.log("======================================================================");
  console.log(`Sender Address:  ${account.addr.toString()}`);
  console.log(`Target Gateway:  ${TARGET_URL}\n`);

  // Create AVM Client Signer using secret key
  const avmSigner = toClientAvmSigner(account.sk, {
    algodClient: algodClient as any
  });

  const client = new x402Client();
  client.register(ALGORAND_MAINNET_CAIP2, new ExactAvmScheme(avmSigner as any));

  const httpClient = new x402HTTPClient(client);

  const pinnedCid = "bafkreiewws62ozsuqdylwhlj2ylu7hxauxygofmiuiezncvmjg2gofg2hq";

  console.log(`[Step 1] Querying Initial Pin Status for CID ${pinnedCid}...`);
  const statusResBefore = await axios.get(`${TARGET_URL}/api/v1/pin/${pinnedCid}`);
  console.log("Initial Status:", statusResBefore.data);

  console.log(`\n[Step 2] Executing 50% Early Renewal Request on Live Mainnet for CID ${pinnedCid}...`);
  const renewUrl = `${TARGET_URL}/api/v1/renew`;
  const renewPayload = { cid: pinnedCid };

  let res402: any;
  try {
    await axios.post(renewUrl, renewPayload);
  } catch (err: any) {
    if (err.response && err.response.status === 402) {
      res402 = err.response;
      console.log("✅ Received Renewal HTTP 402 Challenge!");
    } else {
      console.error("❌ Unexpected Error:", err?.message);
      return;
    }
  }

  const challenge = httpClient.getPaymentRequiredResponse((h) => res402.headers[h.toLowerCase()]);
  console.log("Extracted Renewal Challenge:", challenge);

  const paymentPayload = await client.createPaymentPayload(challenge as any);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  console.log("\n[Step 3] Submitting Paid Renewal Request to Heroku Gateway...");
  const renewRes = await axios.post(renewUrl, renewPayload, {
    headers: {
      ...paymentHeaders
    }
  });

  console.log("\n🎉 RENEWAL SUCCESS! Retention Period Extended:");
  console.log(JSON.stringify(renewRes.data, null, 2));

  console.log(`\n[Step 4] Checking Updated Pin Retention Status...`);
  const statusResAfter = await axios.get(`${TARGET_URL}/api/v1/pin/${pinnedCid}`);
  console.log("Updated Status:", statusResAfter.data);
}

runOfficialX402Payment().catch(err => console.error("Unhandled Error:", err));
