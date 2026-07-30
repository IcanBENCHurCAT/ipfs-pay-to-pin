import { config } from "dotenv";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
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
import { rateLimiterMiddleware, rateLimitCleanupInterval } from "./middleware/rateLimiter.js";

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

// Protect against OOM attacks on Heroku 512MB dynos (20MB max request body)
app.use("*", bodyLimit({
    maxSize: 20 * 1024 * 1024,
    onError: (c) => {
        return c.json({ error: "Payload Too Large", message: "File payload exceeds 20MB maximum limit." }, 413);
    }
}));

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
                description: "Upload one file as a Base64-encoded JSON payload; on successful payment, the service pins it to IPFS for 365 days and returns cid, ipfs_cid, gateway_url, expires_at, and renewal_url.",
                methods: ["POST"],
                networks: ["algorand:mainnet", "algorand:testnet"]
            },
            {
                path: "/api/v1/renew",
                url: "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/renew",
                description: "Renew an existing pin for another 365 days via x402 microUSDC payment. 50% early renewal discount applies prior to expiration.",
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
            },
            {
                "url": "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/renew",
                "protocolBinding": "HTTP",
                "protocolVersion": "1.1"
            },
            {
                "url": "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/pin/{cid}",
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
            },
            {
                "id": "ipfs_renew_pin",
                "name": "Renew IPFS Pin",
                "description": "Renew an existing IPFS pin for another 365 days via an x402 microUSDC payment. 50% early renewal discount applies if renewed before expiration.",
                "tags": ["ipfs", "storage", "renew", "x402-global-challenge"],
                "examples": ["Renew my IPFS pin for CID bafy..."]
            },
            {
                "id": "ipfs_pin_status",
                "name": "Check IPFS Pin Status",
                "description": "Check the status, expiration date, and active state of an IPFS pin.",
                "tags": ["ipfs", "status"],
                "examples": ["What is the status of my IPFS pin for CID bafy..."]
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
   - Response: \`402 Payment Required\` header \`PAYMENT-REQUIRED\` (Includes a 50% early renewal discount if renewed before expiration).
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
            },
            "/api/v1/renew": {
                post: {
                    summary: "Renew IPFS Pin",
                    description: "Renews an existing IPFS pin for another 365 days. Returns a 402 Payment Required challenge. 50% early renewal discount applies if renewed before expiration.",
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        cid: {
                                            type: "string",
                                            description: "The CID of the file to renew"
                                        }
                                    },
                                    required: ["cid"]
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Pin successfully renewed",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string" },
                                            message: { type: "string" },
                                            cid: { type: "string" },
                                            expires_at: { type: "string" },
                                            renewals_count: { type: "number" }
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
            },
            "/api/v1/pin/{cid}": {
                get: {
                    summary: "Check Pin Status",
                    description: "Free status lookup endpoint to check the retention status of an IPFS pin.",
                    parameters: [
                        {
                            name: "cid",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string"
                            },
                            description: "The CID of the pinned file"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Status successfully retrieved",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            pinned_at: { type: "string" },
                                            expires_at: { type: "string" },
                                            days_remaining: { type: "number" },
                                            is_active: { type: "boolean" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Pin not found"
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
                        price: async (ctx: any) => {
                            let binaryBytes = 1000;
                            try {
                                const body = await ctx.adapter.getBody();
                                if (body && typeof body.data === 'string') {
                                    binaryBytes = Math.floor(body.data.length * 0.75);
                                }
                            } catch {
                                const contentLength = Number(ctx.adapter.getHeader("content-length")) || 0;
                                binaryBytes = Math.max(1000, Math.floor(contentLength * 0.75));
                            }
                            const baseMicroUsdc = 10000; // $0.01 base price
                            const bytePriceMicroUsdc = 0.02; // $0.02 per MB (0.02 microUSDC per byte)
                            const totalMicroUsdc = baseMicroUsdc + (binaryBytes * bytePriceMicroUsdc);
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
            },
            "POST /api/v1/renew": {
                accepts: [
                    {
                        scheme: "exact",
                        price: async (ctx: any) => {
                            let cid;
                            try {
                                const body = await ctx.adapter.getBody();
                                cid = body.cid;
                            } catch (e) {
                                throw new HTTPException(400, { message: "Invalid JSON body" });
                            }
                            
                            const item = await globalFileQueue.findByCid(cid);
                            if (!item) {
                                throw new HTTPException(404, { message: "CID not found" });
                            }
                            
                            const now = Date.now();
                            const gracePeriodEnd = item.expires_at + 30 * 24 * 60 * 60 * 1000;
                            if (now > gracePeriodEnd) {
                                throw new HTTPException(410, { message: "Pin expired and permanently removed" });
                            }
                            
                            const baseMicroUsdc = 10000;
                            const bytePriceMicroUsdc = 0.02;
                            let totalMicroUsdc = baseMicroUsdc + (item.sizeBytes * bytePriceMicroUsdc);
                            
                            if (now < item.expires_at) {
                                totalMicroUsdc = totalMicroUsdc * 0.5; // 50% Early Renewal Discount
                            }
                            
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
                description: "Renew IPFS pin for another 365 days",
                mimeType: "application/json"
            }
        },
        server
    )
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
        const job = await globalFileQueue.addJob(filename, buffer);

        return c.json({
            status: "success",
            message: "Payment verified. File accepted and queued for 365 days of IPFS pinning.",
            filename: filename,
            ipfs_cid: job.cid,
            cid: job.cid,
            gateway_url: job.gatewayUrl,
            pinned_at: new Date(job.pinned_at).toISOString(),
            expires_at: new Date(job.expires_at).toISOString(),
            ttl_days: job.ttl_days,
            renewal_url: `/api/v1/renew`
        }, 201);
    } catch (e: any) {
        return c.json({ error: e.message || "Failed to process file upload" }, 500);
    }
});

// Start background worker polling loop
const workerInterval = setInterval(() => {
    globalFileQueue.processJobs().catch(err => console.error("[Queue Worker Error]", err));
    globalFileQueue.processExpiredPins().catch(err => console.error("[Queue Worker Expired Pins Error]", err));
}, 10000);

app.post("/api/v1/renew", async (c) => {
    try {
        const body = await c.req.json();
        const cid = body['cid'];
        
        if (!cid) {
            return c.json({ error: "Missing cid parameter in JSON payload" }, 400);
        }
        
        const now = Date.now();
        const item = await globalFileQueue.findByCid(cid);
        if (!item) {
            return c.json({ error: "CID not found" }, 404);
        }
        
        const gracePeriodEnd = item.expires_at + 30 * 24 * 60 * 60 * 1000;
        if (now > gracePeriodEnd) {
            return c.json({ error: "Pin expired and permanently removed" }, 410);
        }

        const renewedItem = await globalFileQueue.renewPin(cid);
        if (!renewedItem) {
            return c.json({ error: "Failed to renew pin" }, 500);
        }
        
        return c.json({
            status: "success",
            message: "Payment verified. Pin extended for 365 days.",
            cid: renewedItem.cid,
            expires_at: new Date(renewedItem.expires_at).toISOString(),
            renewals_count: renewedItem.renewalsCount
        }, 200);
    } catch (e: any) {
        return c.json({ error: e.message || "Failed to process pin renewal" }, 500);
    }
});

app.get("/api/v1/pin/:cid", async (c) => {
    const cid = c.req.param("cid");
    const status = await globalFileQueue.getPinStatus(cid);
    
    if (!status) {
        return c.json({ error: "Pin not found" }, 404);
    }
    
    return c.json(status, 200);
});

const healthHandler = async (c: any) => {
    const isHealthy = globalFileQueue.isHealthy();
    const status = isHealthy ? "ok" : "degraded";
    const statusCode = isHealthy ? 200 : 503;
    return c.json({
        status,
        ready: isHealthy,
        uptime: process.uptime(),
        queue: {
            size: globalFileQueue.getQueueSize(),
            max_size: globalFileQueue.getMaxQueueSize(),
            is_healthy: isHealthy,
        },
        timestamp: new Date().toISOString(),
    }, statusCode);
};

app.get("/health", healthHandler);
app.get("/healthz", healthHandler);
app.get("/ready", healthHandler);

const port = Number(process.env.PORT) || 4021;
console.log(`x402 Gateway Resource Server starting on port ${port}...`);

if (process.env.NODE_ENV !== 'test') {
    // Rebuild & recover memory state from Supabase PostgreSQL on startup
    await globalFileQueue.init().catch(err => console.error("[Boot Error] Failed to initialize queue state:", err));

    const serverInstance = serve({
        fetch: app.fetch,
        port: port,
        hostname: '0.0.0.0'
    });

    const shutdown = () => {
        console.log("[Shutdown] Received termination signal, gracefully closing server...");
        clearInterval(workerInterval);
        clearInterval(rateLimitCleanupInterval);
        serverInstance.close(() => {
            console.log("[Shutdown] Server closed cleanly.");
            process.exit(0);
        });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

export default app;
