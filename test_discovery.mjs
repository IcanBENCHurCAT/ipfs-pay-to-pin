import { declareDiscoveryExtension } from "@x402/extensions";
console.log(JSON.stringify(declareDiscoveryExtension({ bodyType: "form-data", input: { file: "file" } })));
