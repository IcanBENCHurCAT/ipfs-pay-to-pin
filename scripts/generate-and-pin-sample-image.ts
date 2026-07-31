import { IpfsPayToPinClient } from '../sdk/src/index.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const mnemonic = process.env.DEPLOYER_MNEMONIC || process.env.ALGORAND_WALLET_MNEMONIC || "";
if (!mnemonic) {
  console.error("❌ Error: No ALGORAND_WALLET_MNEMONIC found in .env");
  process.exit(1);
}

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1117" />
      <stop offset="100%" stop-color="#161b22" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0052FF" />
      <stop offset="100%" stop-color="#00D2FF" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="24" fill="url(#bg)" stroke="#30363d" stroke-width="4"/>
  <circle cx="200" cy="160" r="70" fill="url(#accent)" opacity="0.9"/>
  <text x="200" y="175" font-family="sans-serif" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">x402</text>
  <text x="200" y="280" font-family="sans-serif" font-size="22" font-weight="bold" fill="#e6edf3" text-anchor="middle">IPFS Pay-to-Pin Verified</text>
  <text x="200" y="320" font-family="sans-serif" font-size="16" fill="#8b949e" text-anchor="middle">Algorand microUSDC Micropayments</text>
</svg>`;

async function main() {
  console.log("======================================================================");
  console.log("  Testing 1-Line Client SDK Pinning with High-Res SVG Image ");
  console.log("======================================================================");

  // 1. Initialize Client with 1-Line Setup
  const client = new IpfsPayToPinClient({
    gatewayUrl: "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com",
    mnemonic,
    maxPriceUsdc: 0.05 // Budget cap safety
  });

  console.log(`Initialized Client Wallet: ${client.getAddress()}\n`);

  // Save local sample copy
  const samplePath = path.join(process.cwd(), 'ipfs_pay_to_pin_verified.svg');
  fs.writeFileSync(samplePath, SAMPLE_SVG);
  console.log(`Saved local sample to ${samplePath}`);

  // 2. Execute 1-Line Pinning Call!
  console.log("Executing 1-line pinFile() call...");
  const pin = await client.pinFile({
    filename: "ipfs_pay_to_pin_verified.svg",
    data: Buffer.from(SAMPLE_SVG)
  });

  console.log("\n🎉 SUCCESS! File Pinned to IPFS:");
  console.log(`- Pinned CID: ${pin.cid}`);
  console.log(`- Gateway URL: https://ipfs.io/ipfs/${pin.cid}`);
  console.log(`- Pinata Gateway URL: https://amber-extensive-crawdad-745.mypinata.cloud/ipfs/${pin.cid}`);
  console.log(`- Expires At: ${pin.expires_at} (365 Days Retention)\n`);

  // 3. Free Status Lookup
  console.log("Checking Pin Retention Status...");
  const status = await client.getPinStatus(pin.cid);
  console.log("Retention Status:", status);
}

main().catch(err => console.error("❌ SDK Pinning Failed:", err));
