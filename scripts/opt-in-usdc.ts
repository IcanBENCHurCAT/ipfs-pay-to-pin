import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

const mnemonic = process.env.DEPLOYER_MNEMONIC_VAR || process.env.ALGORAND_WALLET_MNEMONIC || "";
if (!mnemonic) {
  console.error("No mnemonic found in .env");
  process.exit(1);
}

const account = algosdk.mnemonicToSecretKey(mnemonic);
const algodClient = new algosdk.Algodv2('', process.env.ALGOD_ADDRESS || 'https://mainnet-api.algonode.cloud', '');

async function optInUSDC() {
  console.log("Checking USDC (31566704) opt-in status for:", account.addr.toString());
  const accountInfo = await algodClient.accountInformation(account.addr).do();
  const assets = accountInfo.assets || [];
  const usdcAsset = assets.find((a: any) => Number(a['asset-id']) === 31566704);

  if (usdcAsset) {
    console.log("✅ Wallet is already opted in to USDC (ASA 31566704). Current balance:", Number(usdcAsset.amount));
    return;
  }

  console.log("Opting in to USDC (ASA 31566704) on Mainnet...");
  const params = await algodClient.getTransactionParams().do();
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    assetIndex: 31566704,
    suggestedParams: params,
  });

  const signedTxn = txn.signTxn(account.sk);
  const sendResult = await algodClient.sendRawTransaction(signedTxn).do();
  console.log(`Submitted Opt-in TxID: ${sendResult.txid}`);
  
  await algosdk.waitForConfirmation(algodClient, sendResult.txid, 4);
  console.log("✅ Successfully opted in to USDC!");
}

optInUSDC().catch(err => console.error("❌ Opt-in Error:", err));
