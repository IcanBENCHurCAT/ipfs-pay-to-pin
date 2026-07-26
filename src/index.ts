import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2, USDC_MAINNET_ASA_ID, USDC_TESTNET_ASA_ID } from "@x402/avm";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { bazaarResourceServerExtension } from "@x402/extensions";
import type { ResourceServerExtension } from "@x402/core/types";
import { pinFileToStorage } from "./storage.js";

config();

const escrowAddress = process.env.ESCROW_ADDRESS || "ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY";
const facilitatorUrl = process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";
const networkEnv = (process.env.ALGORAND_NETWORK || "mainnet").toLowerCase();

const networkCaip2 = networkEnv === "mainnet" ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;
const usdcAsaId = networkEnv === "mainnet" ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID;

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const server = new x402ResourceServer(facilitatorClient)
    .register(networkCaip2, new ExactAvmScheme());

// Register Bazaar discovery extension
server.registerExtension(bazaarResourceServerExtension as unknown as ResourceServerExtension);

// Initialize facilitator connection to load supported kinds and schemes
await server.initialize();

const app = new Hono();

// Health check endpoint
app.get("/", (c) => {
    return c.json({
        status: "online",
        service: "IPFS Pay-to-Pin Gateway (@x402/hono)",
        network: networkEnv,
        escrow: escrowAddress
    });
});

app.use(
    "/api/v1/pin",
    paymentMiddleware(
        {
            "POST /api/v1/pin": {
                accepts: [
                    {
                        scheme: "exact",
                        price: "$0.01",
                        network: networkCaip2,
                        payTo: escrowAddress,
                        extra: { asset: usdcAsaId, tag: "x402-global-challenge" }
                    }
                ],
                description: "Real-time IPFS file storage & pinning: accepts uploaded files and returns permanent IPFS CID and gateway URL via Algorand USDC micropayments",
                mimeType: "multipart/form-data"
            }
        },
        server
    )
);

app.post("/api/v1/pin", async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['file'];

        if (!file || !(file instanceof File)) {
            return c.json({ error: "Missing or invalid file parameter in form-data" }, 400);
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const pinResult = await pinFileToStorage(buffer, file.name || "pinned_file");

        return c.json({
            status: "success",
            message: "Payment verified. File pinned permanently.",
            filename: file.name || "pinned_file",
            ipfs_cid: pinResult.ipfs_cid,
            cid: pinResult.ipfs_cid,
            gateway_url: pinResult.gateway_url
        }, 201);
    } catch (e: any) {
        return c.json({ error: e.message || "Failed to pin file" }, 500);
    }
});

const port = Number(process.env.PORT) || 4021;
console.log(`x402 Gateway Resource Server starting on port ${port}...`);

serve({
    fetch: app.fetch,
    port: port,
    hostname: '0.0.0.0'
});
