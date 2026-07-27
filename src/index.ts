import { config } from "dotenv";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { swaggerUI } from "@hono/swagger-ui";
import { serve } from "@hono/node-server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2, USDC_MAINNET_ASA_ID, USDC_TESTNET_ASA_ID } from "@x402/avm";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions";
import type { ResourceServerExtension } from "@x402/core/types";
import { pinFileToStorage } from "./storage.js";
import { rateLimiterMiddleware } from "./middleware/rateLimiter.js";

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

const pinDiscovery = declareDiscoveryExtension({
    bodyType: "json",
    input: {
        filename: "example.png",
        data: "base64_encoded_string_here..."
    },
    inputSchema: {
        type: "object",
        properties: {
            filename: { type: "string", description: "Name of the file" },
            data: { type: "string", description: "Base64 encoded file data" }
        },
        required: ["filename", "data"],
    },
    output: {
        example: {
            status: "success",
            message: "Payment verified. File pinned for 365 days.",
            filename: "pinned_file.png",
            ipfs_cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            gateway_url: "https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
        },
        schema: {
            type: "object",
            properties: {
                status: { type: "string" },
                message: { type: "string" },
                filename: { type: "string" },
                ipfs_cid: { type: "string" },
                cid: { type: "string" },
                gateway_url: { type: "string" }
            },
            required: ["status", "message", "filename", "ipfs_cid", "cid", "gateway_url"]
        }
    }
});

const app = new Hono();

// Global sliding-window rate limiter (60 req/min per IP)
app.use("*", rateLimiterMiddleware);

const logoUrl = "https://gateway.pinata.cloud/ipfs/QmU9AgYdnWXHYqwsan75kJB8JPudY7kxfiguNHyn69BTiy";

// Health check and Merchant metadata endpoint
const x402MetadataHandler = (c: any) => {
    return c.json({
        merchant: {
            name: "IPFS Pay-to-Pin Gateway",
            description: "Pay-per-request infrastructure API giving autonomous agents reliable access to decentralized IPFS storage.",
            icon: logoUrl,
            image: logoUrl,
            iconUrl: logoUrl,
            icon_url: logoUrl,
            avatar: logoUrl,
            avatarUrl: logoUrl,
            contact: "garretparker@gmail.com"
        },
        image: logoUrl,
        icon: logoUrl,
        resources: [
            {
                path: "/api/v1/pin",
                url: "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/pin",
                description: "Upload one file as a Base64-encoded JSON payload; on successful payment, the service pins it to IPFS and returns cid, ipfs_cid, and gateway_url.",
                methods: ["POST"],
                networks: ["algorand:mainnet", "algorand:testnet"]
            }
        ]
    });
};

app.get("/.well-known/x402.json", x402MetadataHandler);
app.get("/.well-known/x402", x402MetadataHandler);

app.get("/.well-known/agent-card.json", (c) => {
    return c.json({
        "name": "IPFS Pay-to-Pin Gateway",
        "description": "Upload one file as a Base64-encoded JSON payload; on successful payment, the service pins it to IPFS.",
        "icon": logoUrl,
        "image": logoUrl,
        "iconUrl": logoUrl,
        "avatarUrl": logoUrl,
        "version": "1.0.0",
        "url": "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com",
        "supportedInterfaces": [
            {
                "url": "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/pin",
                "protocolBinding": "HTTP",
                "protocolVersion": "1.1"
            }
        ],
        "capabilities": {
            "streaming": false,
            "pushNotifications": false
        },
        "defaultInputModes": ["application/json"],
        "defaultOutputModes": ["application/json"],
        "skills": [
            {
                "id": "ipfs_pay_to_pin",
                "name": "Pin File to IPFS",
                "description": "Upload a base64-encoded file and pin it to IPFS via an x402 payment.",
                "tags": ["ipfs", "storage", "ai-agents", "pinning", "x402-global-challenge"],
                "examples": ["Pin my JSON data to IPFS for persistent storage."]
            }
        ]
    });
});

const agentOnboardingPrompt = `
# IPFS Pay-to-Pin Gateway — Agent Onboarding

Welcome, autonomous agent! This service provides decentralized, 365-day IPFS storage via micropayments using the x402 protocol.

## How to use this service:
1. Make a POST request to \`/api/v1/pin\` with a JSON payload containing:
   - \`filename\` (string): The name of your file
   - \`data\` (string): The Base64-encoded contents of your file
2. You will receive a \`402 Payment Required\` response. The \`PAYMENT-REQUIRED\` header will contain an x402 challenge outlining the payment terms (microUSDC on Algorand).
3. Use your x402 client/wallet SDK to sign a payment satisfying the challenge.
4. Resend your exact original POST request, but this time include the \`PAYMENT-SIGNATURE\` header with your signed payment payload.
5. Upon successful settlement, the server will return a \`201 Created\` response containing the \`cid\`, \`ipfs_cid\`, and a \`gateway_url\` where your pinned file can be accessed for 365 days.

You can view the full OpenAPI specification at \`/openapi.json\`.
`;

app.get("/", (c) => {
    return c.text(agentOnboardingPrompt);
});

app.get("/llms.txt", (c) => {
    return c.text(agentOnboardingPrompt);
});

app.get("/openapi.json", (c) => {
    return c.json({
        openapi: "3.0.0",
        info: {
            title: "IPFS Pay-to-Pin Gateway",
            version: "1.0.0",
            description: "Pay-per-request infrastructure API giving autonomous agents reliable access to decentralized IPFS storage."
        },
        servers: [
            { url: "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com" },
            { url: "http://localhost:4021" }
        ],
        paths: {
            "/api/v1/pin": {
                post: {
                    summary: "Upload and Pin File",
                    description: "Uploads a Base64-encoded file via JSON payload. Returns a 402 Payment Required challenge. Upon payment verification, pins the file to IPFS and returns the CID.",
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        filename: {
                                            type: "string",
                                            description: "The name of the file"
                                        },
                                        data: {
                                            type: "string",
                                            description: "Base64-encoded file data"
                                        }
                                    },
                                    required: ["filename", "data"]
                                }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "File successfully pinned",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string" },
                                            message: { type: "string" },
                                            filename: { type: "string" },
                                            ipfs_cid: { type: "string" },
                                            cid: { type: "string" },
                                            gateway_url: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "402": {
                            description: "Payment Required - Returns x402 payment challenge"
                        }
                    }
                }
            }
        }
    });
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

app.get("/", (c) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPFS Pay-to-Pin Gateway</title>
    <meta name="description" content="Pay-per-request infrastructure API that solves one of the biggest bottlenecks in the AI industry: giving autonomous agents reliable access to decentralized IPFS storage.">
    <meta property="og:title" content="IPFS Pay-to-Pin Gateway">
    <meta property="og:description" content="Pay-per-request infrastructure API that solves one of the biggest bottlenecks in the AI industry: giving autonomous agents reliable access to decentralized IPFS storage.">
</head>
<body style="font-family: sans-serif; padding: 2rem;">
    <h1>IPFS Pay-to-Pin Gateway</h1>
    <p>Status: <strong style="color: green;">online</strong></p>
    <p>Service: IPFS Pay-to-Pin Gateway (@x402/hono)</p>
    <p>Network: ${networkEnv}</p>
    <p>Escrow: <code>${escrowAddress}</code></p>
</body>
</html>`;
    return c.html(html);
});

app.use(
    paymentMiddleware(
        {
            "POST /api/v1/pin": {
                accepts: [
                    {
                        scheme: "exact",
                        price: (ctx) => {
                            const contentLength = Number(ctx.adapter.getHeader("content-length")) || 0;
                            // Approximate original binary size from Base64 JSON payload
                            const approximateBinaryBytes = Math.floor(contentLength * 0.75);
                            const baseMicroUsdc = 10000; // $0.01 base price
                            const bytePriceMicroUsdc = 0.02; // $0.02 per MB (0.02 microUSDC per byte)
                            const totalMicroUsdc = baseMicroUsdc + (approximateBinaryBytes * bytePriceMicroUsdc);
                            return `$${(totalMicroUsdc / 1000000).toFixed(6)}`;
                        },
                        network: networkCaip2,
                        payTo: escrowAddress,
                        maxTimeoutSeconds: 300,
                        extra: {
                            asset: usdcAsaId,
                            tag: "x402-global-challenge",
                            decimals: 6,
                            feePayer: escrowAddress
                        }
                    }
                ],
                description: "Upload one file as a Base64-encoded JSON payload",
                mimeType: "application/json",
                extensions: {
                    ...pinDiscovery
                }
            }
        },
        server
    )
);

app.use(
    "/api/v1/pin",
    bodyLimit({
        maxSize: 50 * 1024 * 1024, // 50MB
        onError: (c) => {
            return c.json({ error: "Payload too large. Maximum file size is 50MB." }, 413);
        }
    })
);

app.post("/api/v1/pin", async (c) => {
    try {
        const body = await c.req.json();
        const filename = body['filename'];
        const data = body['data'];

        if (!filename || !data || typeof data !== 'string') {
            return c.json({ error: "Missing or invalid filename or data parameter in JSON payload" }, 400);
        }

        const buffer = Buffer.from(data, 'base64');

        const pinResult = await pinFileToStorage(buffer, filename);

        return c.json({
            status: "success",
            message: "Payment verified. File pinned for 365 days.",
            filename: filename,
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
