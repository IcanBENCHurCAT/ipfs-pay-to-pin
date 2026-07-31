import { x402HTTPClient, x402Client } from '@x402/core/client';
import { ExactAvmScheme, toClientAvmSigner } from '@x402/avm';
import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

const mnemonic = process.env.DEPLOYER_MNEMONIC_VAR || process.env.ALGORAND_WALLET_MNEMONIC || "";
const account = algosdk.mnemonicToSecretKey(mnemonic);
const algodClient = new algosdk.Algodv2('', process.env.ALGOD_ADDRESS || 'https://mainnet-api.algonode.cloud', '');

console.log("Account:", account.addr.toString());
console.log("ExactAvmScheme:", typeof ExactAvmScheme);
console.log("toClientAvmSigner:", typeof toClientAvmSigner);
