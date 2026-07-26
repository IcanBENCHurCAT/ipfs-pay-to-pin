import { validateBazaarRouteExtensions } from '@x402/extensions';
import { declareDiscoveryExtension } from '@x402/extensions';

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
            message: "Payment verified. File pinned permanently.",
            filename: "pinned_file.png",
            ipfs_cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            gateway_url: "https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
        }
    }
});

const routes = {
    "POST /api/v1/pin": {
        accepts: [
            {
                scheme: "exact",
                price: "0.01",
                network: "eip155:8453",
                payTo: "0x123",
                extra: { asset: "31566704", tag: "x402-global-challenge" }
            }
        ],
        resource: "https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com/api/v1/pin",
        description: "Upload one file as a Base64-encoded JSON payload",
        mimeType: "application/json",
        serviceName: "IPFS Pay-to-Pin Gateway",
        tags: ["ipfs", "storage", "ai-agents", "pinning", "x402-global-challenge"],
        iconUrl: "https://ipfs.io/ipfs/QmU9AgYdnWXHYqwsan75kJB8JPudY7kxfiguNHyn69BTiy",
        extensions: pinDiscovery
    }
};

try {
    validateBazaarRouteExtensions(routes as any);
    console.log("VALIDATION SUCCESS");
} catch (e) {
    console.error("VALIDATION ERROR:", e);
}
