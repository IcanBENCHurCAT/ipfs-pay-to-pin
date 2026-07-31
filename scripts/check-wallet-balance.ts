import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

const mnemonic = process.env.DEPLOYER_MNEMONIC_VAR || process.env.ALGORAND_WALLET_MNEMONIC || "";
if (!mnemonic) {
  console.error("No mnemonic found in .env");
  process.exit(1);
}

const account = algosdk.mnemonicToSecretKey(mnemonic);
console.log("Deployer Address:", account.addr.toString());

const algodClient = new algosdk.Algodv2('', process.env.ALGOD_ADDRESS || 'https://mainnet-api.algonode.cloud', '');

async function checkBalance() {
  const accountInfo = await algodClient.accountInformation(account.addr).do();
  const algoAmount = Number(accountInfo.amount);
  console.log(`ALGO Balance: ${algoAmount / 1_000_000} ALGO`);

  const assets = accountInfo.assets || [];
  const usdcAsset = assets.find((a: any) => Number(a['asset-id']) === 31566704);
  if (usdcAsset) {
    const usdcAmount = Number(usdcAsset.amount);
    console.log(`USDC Balance (ASA 31566704): ${usdcAmount / 1_000_000} USDC (${usdcAmount} microUSDC)`);
  } else {
    console.log("USDC Asset (31566704) not opted in or 0 balance.");
  }
}

checkBalance();
