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
import { globalFileQueue } from "./queue.js";
import { circuitBreakerMiddleware } from "./middleware/circuitBreaker.js";
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
            description: "Pay-per-request API that pins files to IPFS for 365 days via Algorand microUSDC x402 payments.",
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
                description: "Upload a file as a Base64 JSON payload. Returns an x402 microUSDC challenge. Upon payment verification, pins the file to IPFS for 365 days.",
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
        "description": "Upload a file as Base64 JSON. On x402 microUSDC payment, the server pins it to IPFS for 365 days with optional /renew extension.",
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
                "description": "Upload a base64-encoded file and pin it to IPFS for 365 days via an x402 microUSDC payment.",
                "tags": ["ipfs", "storage", "ai-agents", "pinning", "x402-global-challenge"],
                "examples": ["Pin my file to IPFS for 365 days."]
            }
        ]
    });
});

const agentOnboardingPrompt = `
# IPFS Pay-to-Pin Gateway — Agent Reference

An HTTP API that gates file storage (pinning) on IPFS using standard x402 microUSDC micropayments on Algorand. Each payment provides 365 days of pinning retention.

## Endpoints

1. \`POST /api/v1/pin\`
   - Request Body: JSON \`{ "filename": "example.txt", "data": "<base64_string>" }\`
   - Response: \`402 Payment Required\` header \`PAYMENT-REQUIRED\` (microUSDC pricing based on file size).
   - Resubmit: Send exact same POST request with \`PAYMENT-SIGNATURE\` header containing signed transaction.
   - Output (201 Created): Returns \`cid\`, \`ipfs_cid\`, \`gateway_url\`, \`pinned_at\`, \`expires_at\` (+365 days), and \`renewal_url\`.

2. \`POST /api/v1/renew\`
   - Request Body: JSON \`{ "cid": "<ipfs_cid>" }\`
   - Response: \`402 Payment Required\` header \`PAYMENT-REQUIRED\`.
   - Output (200 OK): Extends retention period by another 365 days and updates \`expires_at\`.

3. \`GET /api/v1/pin/:cid\`
   - Free status lookup endpoint (no payment required).
   - Output (200 OK): Returns \`pinned_at\`, \`expires_at\`, \`days_remaining\`, and \`is_active\`.

OpenAPI specification available at \`/openapi.json\`.
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
            description: "Pay-per-request API that pins files to IPFS for 365 days via Algorand microUSDC x402 payments."
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

// Circuit breaker check BEFORE payment middleware
app.use("/api/v1/pin", circuitBreakerMiddleware);

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

        // Add job to local buffer queue and calculate deterministic CID
        const job = globalFileQueue.addJob(filename, buffer);

        return c.json({
            status: "success",
            message: "Payment verified. File accepted and queued for 365 days of IPFS pinning.",
            filename: filename,
            ipfs_cid: job.cid,
            cid: job.cid,
            gateway_url: job.gatewayUrl
        }, 201);
    } catch (e: any) {
        return c.json({ error: e.message || "Failed to process file upload" }, 500);
    }
});

// Start background worker polling loop
setInterval(() => {
    globalFileQueue.processJobs().catch(err => console.error("[Queue Worker Error]", err));
}, 10000);

const port = Number(process.env.PORT) || 4021;
console.log(`x402 Gateway Resource Server starting on port ${port}...`);

serve({
    fetch: app.fetch,
    port: port,
    hostname: '0.0.0.0'
});
