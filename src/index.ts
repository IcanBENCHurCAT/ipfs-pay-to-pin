import { config as loadDotenv } from "dotenv";
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { swaggerUI } from "@hono/swagger-ui";
import { serve } from "@hono/node-server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2, USDC_MAINNET_ASA_ID, USDC_TESTNET_ASA_ID, getSenderFromTransaction } from "@x402/avm";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions";
import type { ResourceServerExtension } from "@x402/core/types";
import { globalFileQueue } from "./queue.js";
import { circuitBreakerMiddleware } from "./middleware/circuitBreaker.js";
import { rateLimiterMiddleware, rateLimitCleanupInterval } from "./middleware/rateLimiter.js";
import { initiateOnChainRefund } from "./refund.js";
import { config, validateConfig } from "./config.js";

process.on('uncaughtException', (err: any) => {
    if (process.env.NODE_ENV === 'production') {
        console.error('[CRITICAL UNCAUGHT EXCEPTION]', err?.message || 'An unexpected error occurred');
    } else {
        console.error('[CRITICAL UNCAUGHT EXCEPTION]', err?.stack || err);
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
    if (process.env.NODE_ENV === 'production') {
        const message = reason instanceof Error ? reason.message : String(reason);
        console.error('[CRITICAL UNHANDLED REJECTION]', message || 'An unhandled rejection occurred');
    } else {
        console.error('[CRITICAL UNHANDLED REJECTION]', reason);
    }
});

loadDotenv();
validateConfig();

console.log("[Boot] Initializing Gateway on Node.js runtime...", {
    nodeEnv: process.env.NODE_ENV,
    network: process.env.ALGORAND_NETWORK,
    port: process.env.PORT,
    escrow: process.env.ESCROW_ADDRESS ? `${process.env.ESCROW_ADDRESS.slice(0, 6)}...` : 'undefined',
    hasPinataJwt: Boolean(process.env.PINATA_JWT),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL)
});

const escrowAddress = process.env.ESCROW_ADDRESS || "ZJEC6JMCNYZFJUQIA4KRVXPTU34F2UQCRZEB5BX5ZS57CPVKTUFK3WA5IY";
const facilitatorUrl = process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";
const networkEnv = (process.env.ALGORAND_NETWORK || "mainnet").toLowerCase();

const ALGORAND_MAINNET_FULL_CAIP2 = "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=";
const networkCaip2 = networkEnv === "mainnet" ? ALGORAND_MAINNET_FULL_CAIP2 : ALGORAND_TESTNET_CAIP2;
const usdcAsaId = networkEnv === "mainnet" ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID;

import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";

const BASE_MAINNET_CAIP2 = "eip155:8453";
const ARBITRUM_ONE_CAIP2 = "eip155:42161";
const ETHEREUM_MAINNET_CAIP2 = "eip155:1";
const SOLANA_MAINNET_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

const evmEscrowAddress = process.env.EVM_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000";
const solanaEscrowAddress = process.env.SOLANA_ESCROW_ADDRESS || "11111111111111111111111111111111";

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const server = new x402ResourceServer(facilitatorClient)
    .register(ALGORAND_MAINNET_CAIP2, new ExactAvmScheme())
    .register(ALGORAND_MAINNET_FULL_CAIP2, new ExactAvmScheme())
    .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme())
    .register(BASE_MAINNET_CAIP2, new ExactEvmScheme())
    .register(ARBITRUM_ONE_CAIP2, new ExactEvmScheme())
    .register(ETHEREUM_MAINNET_CAIP2, new ExactEvmScheme())
    .register(SOLANA_MAINNET_CAIP2, new ExactSvmScheme());

// Register Bazaar discovery extension
server.registerExtension(bazaarResourceServerExtension as unknown as ResourceServerExtension);

// Initialize facilitator connection to load supported kinds and schemes
if (process.env.NODE_ENV !== 'test') {
    try {
        await server.initialize();
        console.log("[x402] Server initialized successfully with facilitator.");
    } catch (err: any) {
        console.warn("[x402 Warning] Facilitator connection check failed during startup; continuing in resilient fallback mode:", err?.message || err);
    }
}

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

// ⚡ Bolt: Pre-calculate CORS origins once on startup instead of parsing per-request
// to eliminate O(N) array allocation and URL parsing overhead on the event loop.
let cachedAllowedOrigins: Set<string> = new Set();
let isCorsWildcard = false;
let lastCorsOriginConfig = config.corsOrigin;

const initCorsOrigins = () => {
    const rawOrigin = config.corsOrigin;
    const defaultOrigins = [
        "https://pay-to-pin.duckdns.org",
        "http://localhost:3000",
        "http://localhost:4021"
    ];

    cachedAllowedOrigins = new Set();
    isCorsWildcard = false;

    if (!rawOrigin || !rawOrigin.trim()) {
        cachedAllowedOrigins = new Set(defaultOrigins);
    } else {
        const parts = rawOrigin.split(',');
        for (let i = 0; i < parts.length; i++) {
            const o = parts[i].trim();
            if (!o) continue;
            if (o === '*') {
                isCorsWildcard = true;
                continue;
            }
            try {
                const u = new URL(o);
                if (u.protocol === 'http:' || u.protocol === 'https:') {
                    cachedAllowedOrigins.add(u.origin);
                }
            } catch {
                // Discard malformed URL entries securely
            }
        }
    }
};

initCorsOrigins();

// 🛡️ Sentinel: Restrict CORS origin to trusted domains and strictly validate origin URLs
// to prevent unauthorized web applications or misconfigured substring entries from making cross-origin requests.
const getCorsOrigin = (reqOrigin: string): string | null => {
    // ⚡ Bolt: allow config hot-reloading for tests without rebuilding
    if (config.corsOrigin !== lastCorsOriginConfig) {
        initCorsOrigins();
        lastCorsOriginConfig = config.corsOrigin;
    }

    if (isCorsWildcard) {
        return '*';
    }

    if (cachedAllowedOrigins.has(reqOrigin)) {
        return reqOrigin;
    }

    return null;
};

app.use("*", cors({
    origin: getCorsOrigin
}));

// Global secure headers middleware
app.use("*", secureHeaders({
    contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"]
    }
}));

// Global error handler to sanitize exceptions returned to clients
app.onError((err: any, c) => {
    if (err instanceof HTTPException || (err && typeof err === 'object' && typeof err.getResponse === 'function')) {
        return err.getResponse();
    }
    if (process.env.NODE_ENV === 'production') {
        console.error('[UNHANDLED HTTP ERROR]', err?.message || 'Unexpected server error');
    } else {
        console.error('[UNHANDLED HTTP ERROR]', err);
    }
    return c.json({ error: "Internal Server Error", message: "An unexpected error occurred." }, 500);
});

// Global sliding-window rate limiter (60 req/min per IP)
app.use("*", rateLimiterMiddleware);

// Protect against OOM attacks on Heroku 512MB dynos (20MB max request body)
app.use("*", bodyLimit({
    maxSize: 20 * 1024 * 1024,
    onError: (c) => {
        return c.json({ error: "Payload Too Large", message: "File payload exceeds 20MB maximum limit." }, 413);
    }
}));

// ⚡ Bolt: Memoize Hono req.json() parsing.
// Hono parses the body on every call to req.json(). The @x402/hono middleware checks the
// body multiple times to calculate dynamic prices across different payment networks.
// Caching the result prevents repeatedly parsing 20MB JSON payloads which blocks the event loop.
app.use("*", async (c, next) => {
    const originalJson = c.req.json.bind(c.req);
    let cachedJson: any;
    let hasCached = false;

    c.req.json = async function<T = any>(): Promise<T> {
        if (hasCached) return cachedJson;
        cachedJson = await originalJson();
        hasCached = true;
        return cachedJson;
    };

    await next();
});

const logoUrl = "https://gateway.pinata.cloud/ipfs/QmU9AgYdnWXHYqwsan75kJB8JPudY7kxfiguNHyn69BTiy";

// Health check and Merchant metadata endpoint
const x402MetadataHandler = (c: Context) => {
    c.header("Cache-Control", "public, max-age=3600, s-maxage=86400");
    // Trigger retention sweeper asynchronously on crawler/indexer discovery checks
    globalFileQueue.processExpiredPins().catch((err) => {
        console.warn("[Queue Worker Sweep Error on x402 discovery]:", err);
    });
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
                url: "https://pay-to-pin.duckdns.org/api/v1/pin",
                description: "Upload one file as a Base64-encoded JSON payload; on successful payment, the service pins it to IPFS for 365 days and returns cid, ipfs_cid, gateway_url, expires_at, and renewal_url.",
                methods: ["POST"],
                networks: ["algorand:mainnet", "algorand:testnet", BASE_MAINNET_CAIP2, SOLANA_MAINNET_CAIP2, ETHEREUM_MAINNET_CAIP2]
            },
            {
                path: "/api/v1/renew",
                url: "https://pay-to-pin.duckdns.org/api/v1/renew",
                description: "Renew an existing pin for another 365 days via x402 microUSDC payment. 50% early renewal discount applies prior to expiration.",
                methods: ["POST"],
                networks: ["algorand:mainnet", "algorand:testnet", BASE_MAINNET_CAIP2, SOLANA_MAINNET_CAIP2, ETHEREUM_MAINNET_CAIP2]
            }
        ]
    });
};

app.get("/.well-known/x402.json", x402MetadataHandler);
app.get("/.well-known/x402", x402MetadataHandler);

app.get("/.well-known/agent-card.json", (c) => {
    c.header("Cache-Control", "public, max-age=3600, s-maxage=86400");
    return c.json({
        "name": "IPFS Pay-to-Pin Gateway",
        "description": "Upload a file as Base64 JSON. On x402 microUSDC payment, the server pins it to IPFS for 365 days with optional /renew extension.",
        "icon": logoUrl,
        "image": logoUrl,
        "iconUrl": logoUrl,
        "avatarUrl": logoUrl,
        "version": "1.0.0",
        "url": "https://pay-to-pin.duckdns.org",
        "supportedInterfaces": [
            {
                "url": "https://pay-to-pin.duckdns.org/api/v1/pin",
                "protocolBinding": "HTTP",
                "protocolVersion": "1.1"
            },
            {
                "url": "https://pay-to-pin.duckdns.org/api/v1/renew",
                "protocolBinding": "HTTP",
                "protocolVersion": "1.1"
            },
            {
                "url": "https://pay-to-pin.duckdns.org/api/v1/pin/{cid}",
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
    c.header("Cache-Control", "public, max-age=3600, s-maxage=86400");
    return c.text(agentOnboardingPrompt);
});

app.get("/llms.txt", (c) => {
    c.header("Cache-Control", "public, max-age=3600, s-maxage=86400");
    return c.text(agentOnboardingPrompt);
});

app.get("/openapi.json", (c) => {
    c.header("Cache-Control", "public, max-age=3600, s-maxage=86400");
    return c.json({
        openapi: "3.0.2",
        info: {
            title: "IPFS Pay-to-Pin Gateway API",
            version: "2.1.2",
            description: "Pay-per-request infrastructure API that solves one of the biggest bottlenecks in the AI industry: giving autonomous agents reliable access to decentralized IPFS storage. Each payment provides 365 days of pinning retention via Algorand, Base, Solana, or Ethereum L1 microUSDC x402 micropayments.",
            contact: {
                name: "IPFS Pay-to-Pin Gateway",
                email: "garretparker@gmail.com"
            },
            license: {
                name: "MIT",
                url: "https://opensource.org/licenses/MIT"
            }
        },
        servers: [
            { url: "https://pay-to-pin.duckdns.org", description: "Production (DuckDNS)" },
            { url: "http://localhost:4021", description: "Local development" }
        ],
        "x-x402": {
            resourceServer: true,
            schemes: [
                {
                    name: "exact",
                    description: "Exact payment scheme — sender must pay exact amount on specified network"
                }
            ],
            supportedNetworks: [
                "algorand:mainnet (algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=)",
                "algorand:testnet",
                "base:8453 (eip155:8453) — gasless EIP-3009 USDC",
                "arbitrum:42161 (eip155:42161) — gasless EIP-3009 USDC",
                "ethereum:1 (eip155:1) — gasless EIP-3009 USDC",
                "solana:mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp)"
            ],
            paymentHeader: {
                request: "PAYMENT-SIGNATURE",
                response: "PAYMENT-REQUIRED"
            }
        },
        paths: {
            "/api/v1/pin": {
                post: {
                    operationId: "pinFile",
                    summary: "Upload and pin a file to IPFS for 365 days",
                    description: "Upload a Base64-encoded file via JSON payload. Returns a 402 Payment Required challenge with an x402 payment header. Upon payment verification, pins the file to IPFS and returns the CID, gateway URL, and expiration data. Supports automatic refunds via x402 on processing failure.\n\n**Pricing:** $0.01 base (10,000 microUSDC) + $0.02/byte ($20/MB). A $2.50 Ethereum L1 gas floor surcharge applies if paying on Ethereum L1.",
                    tags: ["Pins"],
                    security: [{ x402Challenge: [] }],
                    requestBody: {
                        required: true,
                        description: "JSON object with filename (string) and data (Base64-encoded string). Maximum payload: 20 MB.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/PinRequest" },
                                example: {
                                    filename: "document.pdf",
                                    data: "base64_encoded_file_data_here"
                                }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "File successfully pinned to IPFS.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/PinResponse" },
                                    example: {
                                        status: "success",
                                        message: "Payment verified. File successfully pinned to IPFS for 365 days.",
                                        filename: "document.pdf",
                                        ipfs_cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
                                        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
                                        gateway_url: "https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
                                        pinned_at: "2026-09-20T05:00:00.000Z",
                                        expires_at: "2027-09-20T05:00:00.000Z",
                                        ttl_days: 365,
                                        renewal_url: "/api/v1/renew?cid=bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Missing or invalid filename or data parameter.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                                    example: { error: "Missing or invalid filename or data parameter in JSON payload" }
                                }
                            }
                        },
                        "402": {
                            description: "Payment Required. Returns 402 with a PAYMENT-REQUIRED header. Re-submit request with PAYMENT-SIGNATURE header.",
                            headers: {
                                "PAYMENT-REQUIRED": {
                                    description: "Base64-encoded x402 challenge containing accepts array with payment options and validity period.",
                                    schema: { type: "string" }
                                },
                                "Retry-After": {
                                    description: "Max timeout for the x402 challenge window in seconds.",
                                    schema: { type: "integer", example: 300 }
                                }
                            }
                        },
                        "413": {
                            description: "Payload Too Large. File payload exceeds 20 MB maximum limit.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                                    example: {
                                        error: "Payload Too Large",
                                        message: "File payload exceeds 20MB maximum limit."
                                    }
                                }
                            }
                        },
                        "500": {
                            description: "Pinning failed after payment verification. Includes refund transaction ID if automatic refunds are enabled.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ErrorPinResponse" },
                                    example: {
                                        error: "Pinning failed",
                                        message: "Failed to process file upload. Please try again later.",
                                        refund_initiated: true,
                                        refund_tx_id: "TXID1234567890abcdef"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/renew": {
                post: {
                    operationId: "renewPin",
                    summary: "Renew an IPFS pin for another 365 days",
                    description: "Renew an existing IPFS pin for another 365 days. Returns a 402 Payment Required challenge. A 50% early renewal discount applies if renewed before expiration. After 30 days grace period post-expiration, the pin is permanently removed and re-renewal is not possible (410 Gone).",
                    tags: ["Pins"],
                    security: [{ x402Challenge: [] }],
                    requestBody: {
                        required: true,
                        description: "JSON object with the CID to renew.",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/RenewRequest" },
                                example: { cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Pin successfully renewed.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/RenewResponse" },
                                    example: {
                                        status: "success",
                                        message: "Payment verified. Pin extended for 365 days.",
                                        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
                                        expires_at: "2028-09-20T05:00:00.000Z",
                                        renewals_count: 2
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Missing or invalid cid parameter.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                                    example: { error: "Missing cid parameter in JSON payload" }
                                }
                            }
                        },
                        "402": {
                            description: "Payment Required. Re-submit with PAYMENT-SIGNATURE header.",
                            headers: {
                                "PAYMENT-REQUIRED": {
                                    description: "Base64-encoded x402 challenge with renewal pricing.",
                                    schema: { type: "string" }
                                },
                                "Retry-After": {
                                    schema: { type: "integer", example: 300 }
                                }
                            }
                        },
                        "404": {
                            description: "CID not found — the pin has no record.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                                    example: { error: "CID not found" }
                                }
                            }
                        },
                        "410": {
                            description: "Pin expired and permanently removed.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                                    example: { error: "Pin expired and permanently removed" }
                                }
                            }
                        },
                        "500": {
                            description: "Failed to process pin renewal.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                                    example: { error: "Failed to process pin renewal. Please try again later." }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/pin/{cid}": {
                get: {
                    operationId: "getPinStatus",
                    summary: "Check pin status (free, no payment required)",
                    description: "Free status lookup for a pinned CID. Returns retention dates, days remaining, and active state. No x402 payment is required for this endpoint.",
                    tags: ["Pins"],
                    security: [],
                    parameters: [
                        {
                            name: "cid",
                            in: "path",
                            required: true,
                            description: "The IPFS CID to check (e.g., bafybeig...)",
                            schema: { type: "string", format: "ipfs-cid", example: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Pin status returned.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/PinStatusResponse" },
                                    example: {
                                        pinned_at: "2026-09-20T05:00:00.000Z",
                                        expires_at: "2027-09-20T05:00:00.000Z",
                                        days_remaining: 365,
                                        is_active: true,
                                        ttl_days: 365,
                                        renewals_count: 0,
                                        renewal_url: "/api/v1/renew?cid=bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Pin not found.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                                    example: { error: "Pin not found" }
                                }
                            }
                        }
                    }
                }
            },
            "/health": {
                get: {
                    operationId: "healthCheck",
                    summary: "Health check (alias: /healthz, /ready)",
                    description: "Returns the gateway health status. 200 OK if healthy, 503 Service Unavailable if degraded. Includes queue metrics.",
                    tags: ["System"],
                    security: [],
                    responses: {
                        "200": {
                            description: "Gateway is healthy.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/HealthResponse" },
                                    example: {
                                        status: "ok",
                                        ready: true,
                                        uptime: 3600,
                                        queue: { size: 12, max_size: 1000, is_healthy: true },
                                        timestamp: "2026-09-20T05:00:00.000Z"
                                    }
                                }
                            }
                        },
                        "503": {
                            description: "Service degraded.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/HealthResponse" },
                                    example: {
                                        status: "degraded",
                                        ready: false,
                                        uptime: 3600,
                                        queue: { size: 1001, max_size: 1000, is_healthy: false },
                                        timestamp: "2026-09-20T05:00:00.000Z"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/healthz": {
                get: {
                    operationId: "healthCheckZ",
                    summary: "Health check (alias of /health)",
                    description: "Same as /health. Kubernetes-style healthz endpoint.",
                    tags: ["System"],
                    security: [],
                    responses: {
                        "200": {
                            description: "Gateway is healthy.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/HealthResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/ready": {
                get: {
                    operationId: "healthCheckReady",
                    summary: "Readiness check (alias of /health)",
                    description: "Same as /health. Kubernetes-style readiness probe endpoint.",
                    tags: ["System"],
                    security: [],
                    responses: {
                        "200": {
                            description: "Gateway is ready.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/HealthResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/.well-known/x402.json": {
                get: {
                    operationId: "getX402Metadata",
                    summary: "x402 merchant metadata",
                    description: "Returns the x402 merchant metadata required by x402 resource server implementations to discover supported payment schemes, networks, and prices.",
                    tags: ["x402"],
                    security: [],
                    responses: {
                        "200": {
                            description: "x402 merchant metadata.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/X402MetadataResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/.well-known/agent-card.json": {
                get: {
                    operationId: "getAgentCard",
                    summary: "Agent Card specification (W3C Agent-Cards)",
                    description: "Returns the W3C Agent Card specification for this gateway.",
                    tags: ["x402"],
                    security: [],
                    responses: {
                        "200": {
                            description: "W3C Agent Card.",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/AgentCardResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/openapi.json": {
                get: {
                    operationId: "getOpenApiSpec",
                    summary: "OpenAPI specification document (self-describing)",
                    description: "Returns this OpenAPI specification in JSON format.",
                    tags: ["System"],
                    security: [],
                    responses: {
                        "200": {
                            description: "OpenAPI 3.0.2 specification document.",
                            content: {
                                "application/json": {
                                    schema: { type: "object", description: "Full OpenAPI specification document" }
                                }
                            }
                        }
                    }
                }
            },
            "/docs": {
                get: {
                    operationId: "getSwaggerUI",
                    summary: "Swagger UI interactive documentation",
                    description: "Renders Swagger UI for interactive API testing. Uses /openapi.json as source.",
                    tags: ["System"],
                    security: [],
                    responses: {
                        "200": {
                            description: "Swagger UI HTML page.",
                            content: {
                                "text/html": {
                                    schema: { type: "string" }
                                }
                            }
                        }
                    }
                }
            }
        },
        components: {
            schemas: {
                PinRequest: {
                    type: "object",
                    required: ["filename", "data"],
                    properties: {
                        filename: { type: "string", description: "The name of the file to pin (e.g., \"document.pdf\").", minLength: 1, maxLength: 255 },
                        data: { type: "string", description: "Base64-encoded file data. Maximum payload size: 20 MB before encoding.", maxLength: 20971520 }
                    },
                    example: { filename: "document.pdf", data: "base64_encoded_file_data_here" }
                },
                PinResponse: {
                    type: "object",
                    properties: {
                        cid: { type: "string", description: "The IPFS CID for the pinned file." },
                        ipfs_cid: { type: "string", description: "Alias for cid." },
                        gateway_url: { type: "string", format: "uri", description: "Public gateway URL to access the file." },
                        pinned_at: { type: "string", format: "date-time", description: "ISO timestamp when file was pinned." },
                        expires_at: { type: "string", format: "date-time", description: "ISO timestamp when retention expires." },
                        ttl_days: { type: "integer", example: 365, description: "TTL length in days." },
                        status: { type: "string", description: "Status descriptor." },
                        message: { type: "string", description: "Detailed result message." },
                        filename: { type: "string", description: "Original filename." },
                        renewal_url: { type: "string", description: "API path to renew pin." }
                    }
                },
                RenewRequest: {
                    type: "object",
                    required: ["cid"],
                    properties: {
                        cid: { type: "string", description: "The IPFS CID of the pin to renew.", minLength: 1 }
                    },
                    example: { cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" }
                },
                RenewResponse: {
                    type: "object",
                    properties: {
                        status: { type: "string", description: "Status descriptor." },
                        message: { type: "string", description: "Result message confirming renewal." },
                        cid: { type: "string", description: "The IPFS CID that was renewed." },
                        expires_at: { type: "string", format: "date-time", description: "New expiration timestamp." },
                        renewals_count: { type: "integer", description: "Total number of renewals applied." }
                    }
                },
                PinStatusResponse: {
                    type: "object",
                    properties: {
                        pinned_at: { type: "string", format: "date-time" },
                        expires_at: { type: "string", format: "date-time" },
                        days_remaining: { type: "integer", example: 365 },
                        is_active: { type: "boolean" },
                        ttl_days: { type: "integer", example: 365 },
                        renewals_count: { type: "integer" },
                        renewal_url: { type: "string" }
                    }
                },
                HealthResponse: {
                    type: "object",
                    properties: {
                        status: { type: "string", enum: ["ok", "degraded"] },
                        ready: { type: "boolean" },
                        uptime: { type: "integer" },
                        queue: { $ref: "#/components/schemas/QueueMetrics" },
                        timestamp: { type: "string", format: "date-time" }
                    }
                },
                QueueMetrics: {
                    type: "object",
                    properties: {
                        size: { type: "integer" },
                        max_size: { type: "integer" },
                        is_healthy: { type: "boolean" }
                    }
                },
                ErrorResponse: {
                    type: "object",
                    properties: {
                        error: { type: "string" },
                        message: { type: "string" }
                    }
                },
                ErrorPinResponse: {
                    allOf: [
                        { $ref: "#/components/schemas/ErrorResponse" },
                        {
                            type: "object",
                            properties: {
                                refund_initiated: { type: "boolean" },
                                refund_tx_id: { type: "string" }
                            }
                        }
                    ]
                },
                X402MetadataResponse: {
                    type: "object",
                    properties: {
                        merchant: { type: "object" },
                        image: { type: "string", format: "uri" },
                        icon: { type: "string", format: "uri" },
                        resources: { type: "array", items: { type: "object" } }
                    }
                },
                AgentCardResponse: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        version: { type: "string" },
                        capabilities: { type: "object" },
                        defaultInputModes: { type: "array", items: { type: "string" } },
                        defaultOutputModes: { type: "array", items: { type: "string" } },
                        skills: { type: "array", items: { type: "object" } },
                        supportedInterfaces: { type: "array", items: { type: "object" } }
                    }
                }
            },
            securitySchemes: {
                x402Challenge: {
                    type: "apiKey",
                    in: "header",
                    name: "PAYMENT-SIGNATURE",
                    description: "x402 payment signature header."
                }
            }
        },
        tags: [
            { name: "Pins", description: "Pin, unpin, renew, and check file pin status on IPFS." },
            { name: "System", description: "Health, documentation, and OpenAPI endpoints." },
            { name: "x402", description: "x402 payment protocol metadata and merchant discovery." }
        ]
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

// Circuit breaker check BEFORE payment middleware for both /pin and /renew
app.use("/api/v1/pin", circuitBreakerMiddleware);
app.use("/api/v1/renew", circuitBreakerMiddleware);

// Security headers middleware
app.use("*", async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "1; mode=block");
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    c.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
    await next();
});

const calculateUsdcPrice = async (ctx: any, isEthereumL1 = false) => {
    let binaryBytes = 1000;
    try {
        const body = await ctx.adapter.getBody();
        // 🛡️ Sentinel: Validate missing or invalid data payload to prevent financial exploit
        // Fail securely by throwing a 400 error rather than continuing with undefined values
        if (!body || !body.data || typeof body.data !== 'string' || body.data.length === 0) {
            throw new HTTPException(400, { message: "Missing or invalid data parameter in JSON payload" });
        }

        const dataLen = body.data.length;
        let padding = 0;
        if (dataLen > 1) {
            if (body.data[dataLen - 1] === '=') {
                padding = body.data[dataLen - 2] === '=' ? 2 : 1;
            }
        }
        binaryBytes = Math.floor(((dataLen - padding) * 3) / 4);
    } catch (e: any) {
        if (e instanceof HTTPException) throw e;
        throw new HTTPException(400, { message: "Invalid JSON body" });
    }
    const baseMicroUsdc = 10000; // $0.01 base price
    const bytePriceMicroUsdc = 0.02; // $0.02 per MB (0.02 microUSDC per byte)
    let totalMicroUsdc = baseMicroUsdc + (binaryBytes * bytePriceMicroUsdc);
    if (isEthereumL1) {
        totalMicroUsdc += 2500000; // $2.50 L1 gas floor surcharge
    }
    return `$${(totalMicroUsdc / 1000000).toFixed(6)}`;
};

try {
    app.use(
        paymentMiddleware(
            {
                "POST /api/v1/pin": {
                    accepts: [
                        {
                            scheme: "exact",
                            price: (ctx: any) => calculateUsdcPrice(ctx),
                            network: BASE_MAINNET_CAIP2,
                            payTo: evmEscrowAddress,
                            maxTimeoutSeconds: 300,
                            extra: {
                                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                                eip3009: true,
                                decimals: 6
                            }
                        },
                        {
                            scheme: "exact",
                            price: (ctx: any) => calculateUsdcPrice(ctx),
                            network: SOLANA_MAINNET_CAIP2,
                            payTo: solanaEscrowAddress,
                            maxTimeoutSeconds: 300,
                            extra: {
                                asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                                decimals: 6
                            }
                        },
                        {
                            scheme: "exact",
                            price: (ctx: any) => calculateUsdcPrice(ctx),
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
                                    if (!body || !body.cid || typeof body.cid !== 'string') {
                                        throw new HTTPException(400, { message: "Missing or invalid cid parameter in JSON payload" });
                                    }
                                    cid = body.cid;
                                } catch (e: any) {
                                    if (e instanceof HTTPException) throw e;
                                    throw new HTTPException(400, { message: "Invalid JSON body" });
                                }
                                
                                const item = await globalFileQueue.findAnyByCid(cid);
                                if (!item || item.status === 'FAILED') {
                                    throw new HTTPException(404, { message: "CID not found" });
                                }
                                
                                const now = Date.now();
                                const gracePeriodEnd = item.expires_at + 30 * 24 * 60 * 60 * 1000;
                                if (now > gracePeriodEnd || item.status === 'EXPIRED') {
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
} catch (err: any) {
    console.warn("[x402 Warning] Payment middleware initialization threw RouteConfigurationError; continuing in fallback mode:", err?.message || err);
}


app.post("/api/v1/pin", async (c) => {
    let parsedBinaryBytes: number | null = null;
    try {
        const body = await c.req.json();
        const filename = body['filename'];
        const data = body['data'];

        // 🛡️ Sentinel: Validate filename is a string to prevent type confusion or injection bypasses.
        if (!filename || typeof filename !== 'string' || !data || typeof data !== 'string') {
            return c.json({ error: "Missing or invalid filename or data parameter in JSON payload" }, 400);
        }

        let padding = 0;
        const dataLen = data.length;
        if (dataLen > 1) {
            if (data[dataLen - 1] === '=') {
                padding = data[dataLen - 2] === '=' ? 2 : 1;
            }
        }
        parsedBinaryBytes = Math.floor(((dataLen - padding) * 3) / 4);

        // 🛡️ Sentinel: DoS Protection via Unrestricted Payload Allocation Guard.
        // Validate payload binary size against 20MB limit before Buffer.from allocation to prevent heap exhaustion / OOM crashes.
        const MAX_PAYLOAD_SIZE = 20 * 1024 * 1024;
        if (parsedBinaryBytes > MAX_PAYLOAD_SIZE) {
            return c.json({ error: "Payload Too Large", message: "File payload exceeds 20MB maximum limit." }, 413);
        }

        const buffer = Buffer.from(data, 'base64');

        // Add job to local buffer queue and calculate deterministic CID
        const job = await globalFileQueue.addJob(filename, buffer);

        return c.json({
            status: "success",
            message: job.status === 'PINNED'
                ? "Payment verified. File successfully pinned to IPFS for 365 days."
                : "Payment verified. File accepted and queued for 365 days of IPFS pinning.",
            filename: filename,
            ipfs_cid: job.cid,
            cid: job.cid,
            gateway_url: job.gatewayUrl,
            pinned_at: new Date(job.pinned_at).toISOString(),
            expires_at: new Date(job.expires_at).toISOString(),
            ttl_days: job.ttl_days,
            renewal_url: `/api/v1/renew?cid=${job.cid}`
        }, 201);
    } catch (e: any) {
        if (e instanceof HTTPException) throw e;
        console.error("[Pin Error]", e?.message);
        
        let refundTxId: string | undefined = undefined;
        let refundAttempted = false;

        if (config.enableAutomaticRefunds) {
            // 🛡️ Sentinel: Prevent arbitrary refund target address injection.
            // Extract the refund recipient address from the signed transaction payload in the PAYMENT-SIGNATURE header
            // to ensure refunds are sent strictly to the original on-chain payment sender, not a spoofed header.
            let clientAddress: string | undefined = undefined;
            const paymentSigHeader = c.req.header("payment-signature") || c.req.header("PAYMENT-SIGNATURE");
            if (paymentSigHeader) {
                try {
                    const decodedPayload = JSON.parse(Buffer.from(paymentSigHeader, "base64").toString("utf-8"));
                    const rawTxn = decodedPayload?.payload?.txns?.[0];
                    if (rawTxn && typeof rawTxn === "string") {
                        const txnBytes = new Uint8Array(Buffer.from(rawTxn, "base64"));
                        clientAddress = getSenderFromTransaction(txnBytes, true);
                    }
                } catch (err: any) {
                    console.warn("[Refund Warning] Failed to parse sender address from PAYMENT-SIGNATURE header:", err?.message || err);
                }
            }

            // 🛡️ Sentinel: Prevent untrusted header abuse for refunds.
            // Client-provided payment headers must never be trusted for financial calculations.
            // Refund amounts are strictly computed server-side based on expected pricing.
            let binaryBytes = 1000;
            if (parsedBinaryBytes !== null) {
                binaryBytes = parsedBinaryBytes;
            } else {
                // Determine raw payload size if JSON parsing fails to prevent content-length spoofing
                try {
                    const bodyRaw = await c.req.raw.clone().arrayBuffer();
                    binaryBytes = Math.max(1000, Math.floor(bodyRaw.byteLength * 0.75));
                } catch {
                    binaryBytes = 1000;
                }
            }
            const maxExpectedPrice = 10000 + Math.floor(binaryBytes * 0.02);
            const paidAmount = maxExpectedPrice;

            if (clientAddress) {
                refundAttempted = true;
                const refundRes = await initiateOnChainRefund({
                    recipientAddress: clientAddress,
                    amountMicroUsdc: paidAmount,
                    asaId: Number(usdcAsaId) || 31566704,
                    reason: 'Pinning failure: Upload error'
                });

                if (refundRes.success) {
                    refundTxId = refundRes.txId;
                }
            }
        }

        return c.json({
            error: "Pinning failed",
            message: "Failed to process file upload. Please try again later.",
            refund_initiated: refundAttempted,
            refund_tx_id: refundTxId
        }, 500);
    }
});

// Start background worker polling loop (sequential execution prevents concurrency race conditions)
const workerInterval = setInterval(async () => {
    try {
        await globalFileQueue.processJobs();
        await globalFileQueue.processExpiredPins();
    } catch (err) {
        console.error("[Queue Worker Error]", err);
    }
}, 10000);

app.post("/api/v1/renew", async (c) => {
    try {
        const body = await c.req.json();
        const cid = body['cid'];
        
        if (!cid || typeof cid !== 'string') {
            return c.json({ error: "Missing or invalid cid parameter in JSON payload" }, 400);
        }
        
        const now = Date.now();
        const item = await globalFileQueue.findAnyByCid(cid);
        if (!item || item.status === 'FAILED') {
            return c.json({ error: "CID not found" }, 404);
        }
        
        const gracePeriodEnd = item.expires_at + 30 * 24 * 60 * 60 * 1000;
        if (now > gracePeriodEnd || item.status === 'EXPIRED') {
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
        if (e instanceof HTTPException) throw e;
        console.error("[Renew Error]", e?.message || e);
        return c.json({ error: "Failed to process pin renewal. Please try again later." }, 500);
    }
});

app.get("/api/v1/pin/:cid", async (c) => {
    const cid = c.req.param("cid");

    // 🛡️ Sentinel: Validate routing identifier length and emptiness before passing to data layers
    // to prevent application-level DoS or obscure backend errors from malformed input.
    if (!cid || cid.trim() === '' || cid.length > 255) {
        return c.json({ error: "Invalid CID parameter" }, 400);
    }

    const status = await globalFileQueue.getPinStatus(cid);
    
    if (!status) {
        return c.json({ error: "Pin not found" }, 404);
    }
    
    return c.json(status, 200);
});

const healthHandler = async (c: Context) => {
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
