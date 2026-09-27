import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

const mnemonic = process.env.DEPLOYER_MNEMONIC || process.env.ALGORAND_WALLET_MNEMONIC || "";
if (!mnemonic) {
  console.error("No mnemonic found in .env");
  process.exit(1);
}

const account = algosdk.mnemonicToSecretKey(mnemonic);
const algodClient = new algosdk.Algodv2('', process.env.ALGOD_ADDRESS || 'https://mainnet-api.algonode.cloud', '');

const USDC_ASA_ID = 31566704;

async function optInUSDC() {
  console.log(`Checking USDC (${USDC_ASA_ID}) opt-in status for:`, account.addr.toString());
  const accountInfo = await algodClient.accountInformation(account.addr).do();
  const assets: any[] = accountInfo.assets || [];

  // Single-pass for loop with direct comparison avoids Array.prototype.find closure allocation overhead
  let usdcAsset: any = undefined;
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    if (a['asset-id'] === USDC_ASA_ID || a.assetId === USDC_ASA_ID || Number(a['asset-id']) === USDC_ASA_ID) {
      usdcAsset = a;
      break;
    }
  }

  if (usdcAsset) {
    console.log(`✅ Wallet is already opted in to USDC (ASA ${USDC_ASA_ID}). Current balance:`, Number(usdcAsset.amount));
    return;
  }

  console.log(`Opting in to USDC (ASA ${USDC_ASA_ID}) on Mainnet...`);
  const params = await algodClient.getTransactionParams().do();
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    assetIndex: USDC_ASA_ID,
    suggestedParams: params,
  });

  const signedTxn = txn.signTxn(account.sk);
  const sendResult = await algodClient.sendRawTransaction(signedTxn).do();
  console.log(`Submitted Opt-in TxID: ${sendResult.txid}`);
  
  await algosdk.waitForConfirmation(algodClient, sendResult.txid, 4);
  console.log("✅ Successfully opted in to USDC!");
}

optInUSDC().catch(err => console.error("❌ Opt-in Error:", err));
