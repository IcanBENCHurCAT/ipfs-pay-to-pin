/**
 * OpenAI Function Calling Example — IPFS Pay-to-Pin (TypeScript)
 *
 * Demonstrates how to give an OpenAI-powered AI agent the ability to
 * upload files to IPFS using Algorand microUSDC x402 payments.
 *
 * This example uses the `@langchain/openai` adapter with function calling
 * to let the model decide when and how to pin files.
 *
 * Installation:
 *   npm install @langchain/openai @langchain/core ipfs-pay-to-pin-client
 *   npm install dotenv
 *
 * Usage:
 *   npx tsx example.ts
 *
 * Environment:
 *   OPENAI_API_KEY=sk-...
 *   ALGORAND_MNEMONIC="your 25 words..."
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  IPFS_PIN_FILE_FUNCTION,
  type IpfsPayToPinToolOptions,
  createIpfsTool,
} from "../langchain/ts/ipfs-pay-to-pin-tool";
import * as dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// Function definition for OpenAI Function Calling (matches schema.json)
// ---------------------------------------------------------------------------

export const IPFS_PIN_FILE_FUNCTION: Record<string, unknown> = {
  name: "ipfs_pin_file",
  description:
    "Upload a file to IPFS using pay-to-pin. The file is pinned for 365 days " +
    "with a microUSDC x402 payment. Returns the IPFS Content ID (CID) and a " +
    "gateway URL to access the file.",
  parameters: {
    type: "object" as const,
    properties: {
      filename: {
        type: "string" as const,
        description:
          "Name of the file to upload, including extension. Examples: 'report.pdf', 'photo.jpg', 'data.json'",
      },
      file_data: {
        type: "string" as const,
        description:
          "Base64-encoded content of the file. Encode the raw file bytes using base64 before passing them here.",
      },
      max_price_usdc: {
        type: "number" as const,
        description:
          "Maximum price in USDC to pay for this pin. Defaults to 1.0. Set lower to cap spending.",
      },
    },
    required: ["filename", "file_data"],
    additionalProperties: false,
  },
  strict: false,
};

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

async function handleIpfsPinFile(
  args: Record<string, unknown>,
  client: IpfsPayToPinToolOptions
): Promise<string> {
  const { IpfsPayToPinClient } = await import("ipfs-pay-to-pin-client");

  const pinClient = new IpfsPayToPinClient({
    mnemonic: args.mnemonic ?? process.env.ALGORAND_MNEMONIC ?? "",
    network: (args.network as "mainnet" | "testnet") ?? "testnet",
    maxPriceUsdc: (args.maxPriceUsdc as number) ?? 1.0,
  });

  const filename = (args.filename as string) || "untitled";
  const fileData = args.file_data as Buffer | string;

  try {
    const result = await pinClient.pinFile({
      filename,
      data: fileData,
    });

    return (
      `✅ Successfully pinned '${result.filename}' to IPFS!\n` +
      `  CID: ${result.ipfs_cid}\n` +
      `  Gateway URL: ${result.gateway_url}\n` +
      `  Status: ${result.status}\n` +
      `  Pinned At: ${result.pinned_at}\n` +
      `  Expires At: ${result.expires_at} (${result.ttl_days} days)`
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "InsufficientBudgetError") {
        return `❌ Budget exceeded: ${error.message}`;
      }
      if (error.name === "PaymentDeclinedError") {
        return `❌ Payment declined: ${error.message}`;
      }
      return `❌ Error: ${error.message}`;
    }
    return `❌ Error: ${String(error)}`;
  }
}

// ---------------------------------------------------------------------------
// Agent loop
// ---------------------------------------------------------------------------

interface AgentConfig {
  openaiApiKey?: string;
  model?: string;
  systemPrompt?: string;
  mnemonic?: string;
  network?: "mainnet" | "testnet";
}

async function runAgent(
  userMessages: string[],
  config: AgentConfig = {}
): Promise<void> {
  const { OPENAI_API_KEY, ALGORAND_MNEMONIC } = process.env;
  const apiKey = config.openaiApiKey || OPENAI_API_KEY;
  const mnemonic = config.mnemonic || ALGORAND_MNEMONIC;

  if (!apiKey) {
    console.error("❌ Set OPENAI_API_KEY environment variable.");
    process.exit(1);
  }

  const model = config.model || "gpt-4o-mini";
  const systemPrompt =
    config.systemPrompt ||
    "You are a helpful AI assistant with the ability to upload files to IPFS using decentralized storage. When the user asks you to upload or store a file, use the ipfs_pin_file function.";

  const llm = new ChatOpenAI({
    modelName: model,
    temperature: 0,
  });

  const messages = [
    new SystemMessage(systemPrompt),
    ...userMessages.map((msg) => new HumanMessage(msg)),
  ];

  console.log("\n" + "=".repeat(60));
  console.log(`👤 You: ${userMessages[userMessages.length - 1]}`);
  console.log("=".repeat(60));

  const response = await llm.invoke(messages);

  console.log("\n🤖 Agent:", response.content);

  // Check if the model wants to call our function
  const toolCalls = (response as any)?.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      console.log(`  📦 Function call: ${toolCall.name}`);
      console.log(`     Args: ${JSON.stringify(toolCall.args, null, 2)}`);

      if (toolCall.name === "ipfs_pin_file") {
        let result: string;

        if (mnemonic) {
          result = await handleIpfsPinFile(
            { ...toolCall.args, mnemonic, network: config.network },
            { mnemonic }
          );
        } else {
          // Demo mode: simulate a successful pin
          const filename = (toolCall.args as any).filename || "test";
          const simulatedCid =
            "bafybeig" +
            require("crypto").createHash("sha256").update(filename).digest("hex").slice(0, 46);
          result = (
            `✅ [DEMO MODE] Pinned '${filename}' to IPFS!\n` +
            `  CID: ${simulatedCid}\n` +
            `  Gateway URL: https://ipfs.io/ipfs/${simulatedCid}\n` +
            `  Status: success (demo)\n` +
            `  Expires At: 2026-08-09\n` +
            `  TTL: 365 days`
          );
        }

        console.log(`\n  📤 Function result:\n${result}`);

        // Append tool response to messages for follow-up
        (response as any).tool_calls.forEach((tc: any, i: number) => {
          messages.push({
            role: "tool" as const,
            content: typeof i === "number" && i === 0 ? result : "",
            tool_call_id: tc.id || `call_${i}`,
          });
        });

        // Let the agent respond to the tool result
        console.log("\n🤖 Agent (responding to tool result):");
        const followUp = await llm.invoke(messages);
        console.log(followUp.content);

        return;
      } else {
        console.log(`  ⚠️  Unknown function: ${toolCall.name}`);
      }
    }
  } else {
    console.log("  ✅ Agent waiting (no function call needed)");
  }
}

// ---------------------------------------------------------------------------
// Demo / Example runs
// ---------------------------------------------------------------------------

async function demoBasic(): Promise<void> {
  console.log("🚀 Demo 1: Simple file upload\n");
  await runAgent([
    "Please upload this text to IPFS: 'Hello from my AI agent! 🤖'",
  ]);
}

async function demoImageUpload(): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");

  const testImagePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "test_image.png"
  );

  if (fs.existsSync(testImagePath)) {
    const fileBuffer = fs.readFileSync(testImagePath);
    const fileBase64 = fileBuffer.toString("base64");

    console.log("\n🖼️  Demo 2: Image upload with base64\n");
    await runAgent([
      `Upload this image to IPFS. Here is the base64 data: ${fileBase64.substring(0, 100)}... (truncated, full data sent)`,
    ]);
  } else {
    console.log("No test image found. Skipping image upload demo.");
  }
}

async function demoTextFile(): Promise<void> {
  console.log("\n📄 Demo 3: Text file upload\n");
  await runAgent([
    "Create a welcome message file and upload it to IPFS as 'welcome.txt'",
  ]);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log(
    "  IPFS Pay-to-Pin × OpenAI Function Calling Demo (TypeScript)"
  );
  console.log("  Giving AI agents their own decentralized storage wallet");
  console.log("=".repeat(60));

  await demoBasic();
  await demoImageUpload();
  await demoTextFile();

  console.log("\n" + "=".repeat(60));
  console.log("  Demo complete! 🎉");
  console.log("=".repeat(60));
}

main().catch(console.error);
