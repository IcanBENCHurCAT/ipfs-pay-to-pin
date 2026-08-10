# How to Give Your AI Agent Its Own IPFS Storage Wallet 🕸️💳

> **Give your AI agents autonomous, on-chain decentralized storage with microUSDC payments.**

Your AI agent can read the web, send emails, and control your smart home — but can it **store files permanently** on IPFS using its own wallet? Not with these tutorials! This guide shows you how to plug the [IPFS Pay-to-Pin](https://github.com/IcanBENCHurCAT/ipfs-pay-to-pin) gateway into any AI agent framework so your agent can store files on IPFS **autonomously**, paying with Algorand microUSDC via the x402 protocol.

## 🎯 Why AI Agents Need Decentralized Storage

Modern AI agents need to persist data beyond their session context window. Centralized storage solutions require API keys, corporate accounts, and human oversight. IPFS + Algorand gives agents:

- **Autonomous identity** — Each agent has its own Algorand wallet and IPFS address
- **Censorship resistance** — Files are stored on a decentralized network
- **Micropayments** — x402 protocol enables frictionless microUSDC payments (cents per pin)
- **No trust required** — Payment and storage are handled on-chain, no third-party API keys for storage
- **Permanent storage** — 365-day pins with automatic renewal options

## 📦 Prerequisites

### 1. Install the SDK

**TypeScript (npm):**
```bash
npm install ipfs-pay-to-pin-client
```

**Python (pip):**
```bash
pip install langchain-core algosdk requests pydantic
```

> The official SDK (`ipfs-pay-to-pin-client`) is TypeScript-only. For Python, this toolkit includes a pure-Python HTTP client that speaks the same x402 protocol — no TypeScript bridge needed!

### 2. Create an Algorand Wallet

You need an Algorand wallet with ALGO (for gas) and USDC (for pinning payments).

**Get testnet ALGO + USDC (free):**
```bash
# Use the Algorand TestNet faucet
# https://bank.testnet.algorand.network
```

**Generate a wallet mnemonic:**
```bash
# Using algosdk CLI (Python)
python3 -c "import algosdk; print(algosdk.mnemonic.generate_mnemonic())"

# Using algosdk CLI (TypeScript/Node)
npx algosdk-mnemonic
```

**Save your mnemonic securely** — anyone with this 25-word phrase controls your wallet!

### 3. Set Environment Variables

```bash
# Your Algorand wallet mnemonic (NEVER commit this!)
export ALGORAND_MNEMONIC="your 25 word mnemonic phrase here"

# For OpenAI function calling demos
export OPENAI_API_KEY="sk-..."

# Use testnet for free testing (default: mainnet)
export PIN_NETWORK="testnet"

# Custom gateway URL (optional)
export GATEWAY_URL="https://pay-to-pin.duckdns.org"
```

## 🚀 Quick Start: 3-Step Setup

```bash
# 1. Clone the repo
git clone https://github.com/IcanBENCHurCAT/ipfs-pay-to-pin.git
cd ipfs-pay-to-pin

# 2. Set up your environment
export ALGORAND_MNEMONIC="your 25 words..."
export OPENAI_API_KEY="sk-..."
export PIN_NETWORK="testnet"

# 3. Pick your framework and go!
# See the examples below for LangChain and OpenAI Function Calling
```

## 🦜 LangChain (Python)

### Installation

```bash
pip install langchain-core algosdk requests pydantic
```

### Full Example

```python
from langchain_core.tools import tool
from ipfs_pay_to_pin_tool import IpfsPayToPinTool
import base64

# Create the tool
tool = IpfsPayToPinTool(
    mnemonic="your 25 word mnemonic",
    network="testnet",
    max_price_usdc=1.0,  # Cap spending at $1.00
)

# Use it in a LangChain agent
from langchain.agents import create_react_agent, Tool
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")
tools = [tool]
agent = create_react_agent(llm, tools)

# The agent can now receive user requests and pin files!
result = agent.invoke({
    "messages": [
        ("human", "Please upload this text to IPFS: 'Hello, agent! 🤖'")
    ]
})
print(result)
# Agent will: encode the text → base64 → call ipfs_pin_file → get CID
```

### Standalone Tool Usage

```python
from ipfs_pay_to_pin_tool import create_ipfs_tool
import base64

tool = create_ipfs_tool(
    mnemonic="your 25 words...",
    network="testnet",
    max_price_usdc=0.50,  # More conservative cap
)

# Direct invocation
content = "Agent-generated data"
b64 = base64.b64encode(content.encode()).decode()

result = tool.invoke({
    "filename": "agent-data.txt",
    "file_data": b64
})
print(result)
# "Successfully pinned 'agent-data.txt' to IPFS! CID: bafy..."
```

## 🦜 LangChain (TypeScript)

### Installation

```bash
npm install ipfs-pay-to-pin-client @langchain/core @langchain/openai
```

### Full Example

```typescript
import { IpfsPayToPinTool, createIpfsTool } from "./ipfs-pay-to-pin-tool";
import { ChatOpenAI } from "@langchain/openai";
import { createReActAgent } from "@langchain/langgraph/prebuilt";

// Create the tool
const tool = createIpfsTool({
  mnemonic: process.env.ALGORAND_MNEMONIC!,
  network: "testnet" as const,
  maxPriceUsdc: 1.0,
});

// Use in a LangChain agent
const llm = new ChatOpenAI({ modelName: "gpt-4o-mini" });

const agent = await createReActAgent(llm, [tool]);

const result = await agent.invoke({
  messages: [
    ["human", "Please upload this file to IPFS: 'Hello from TypeScript agent!'"]
  ],
});
console.log(result);
```

## 🤖 OpenAI Function Calling (Python)

### Installation

```bash
pip install openai algosdk requests pydantic
```

### Full Example

```python
from openai import OpenAI
import base64
import json

# Define the function schema for the OpenAI model
IPFS_PIN_FILE_FUNCTION = {
    "name": "ipfs_pin_file",
    "description": (
        "Upload a file to IPFS using pay-to-pin. "
        "The file is pinned for 365 days with a microUSDC x402 payment. "
        "Returns the IPFS Content ID (CID) and gateway URL."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": "Filename with extension, e.g. 'report.pdf'",
            },
            "file_data": {
                "type": "string",
                "description": "Base64-encoded file content",
            },
            "max_price_usdc": {
                "type": "number",
                "description": "Max price cap in USDC (default: 1.0)",
            },
        },
        "required": ["filename", "file_data"],
    },
}

# Create OpenAI client
client = OpenAI()

# Start the conversation
messages = [
    {"role": "system", "content": (
        "You are an AI assistant with the ability to store files "
        "on IPFS. When asked to upload or save a file, use the "
        "ipfs_pin_file function."
    )},
    {"role": "user", "content": "Upload this to IPFS: 'Agent note 123'"},
]

# Call the model
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
    functions=[IPFS_PIN_FILE_FUNCTION],
    function_call="auto",
)

# Check if the model wants to call our function
if response.choices[0].message.function_call:
    func = response.choices[0].message.function_call
    args = json.loads(func.arguments)

    # Execute the pin operation
    from ipfs_pay_to_pin_tool import X402Client
    import os

    pin_client = X402Client(
        mnemonic=os.environ["ALGORAND_MNEMONIC"],
        network="testnet",
    )

    result = pin_client.pin_file(
        filename=args["filename"],
        file_data=args["file_data"],
    )

    # Send result back to the model
    messages.append({
        "role": "function",
        "name": func.name,
        "content": json.dumps(result),
    })

    # Get final response
    final = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    print(final.choices[0].message.content)
```

## 🤖 OpenAI Function Calling (TypeScript)

### Installation

```bash
npm install @langchain/openai @langchain/core ipfs-pay-to-pin-client
```

### Full Example

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { IpfsPayToPinClient } from "ipfs-pay-to-pin-client";

const IPFS_PIN_FUNCTION = {
  name: "ipfs_pin_file",
  description: "Upload a file to IPFS via x402 micropayment",
  parameters: {
    type: "object" as const,
    properties: {
      filename: { type: "string" as const, description: "Filename with extension" },
      file_data: { type: "string" as const, description: "Base64-encoded content" },
      max_price_usdc: { type: "number" as const, description: "Max price in USDC" },
    },
    required: ["filename", "file_data"],
  },
};

const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 });

const messages = [
  new SystemMessage(
    "You are an AI assistant. When asked to store a file, use ipfs_pin_file."
  ),
  new HumanMessage("Upload 'agent-data.txt' with content: 'Hello IPFS!'"),
];

const response = await llm.invoke(messages, {
  functions: [IPFS_PIN_FUNCTION],
  function_call: "auto",
});

// Handle function call
if ((response as any).tool_calls) {
  for (const tc of (response as any).tool_calls) {
    if (tc.name === "ipfs_pin_file") {
      const client = new IpfsPayToPinClient({
        mnemonic: process.env.ALGORAND_MNEMONIC!,
        network: "testnet",
      });

      const result = await client.pinFile({
        filename: tc.args.filename,
        data: Buffer.from(tc.args.file_data, "base64"),
      });

      console.log(`Pinned to: ${result.gateway_url}`);
    }
  }
}
```

## 🔒 Security Best Practices

### ⚠️ Never Hardcode Mnemonics

**❌ BAD — Hardcoded mnemonic:**
```python
tool = IpfsPayToPinTool(mnemonic="word1 word2 word3 ...")  # NEVER DO THIS
```

**✅ GOOD — Use environment variables:**
```python
import os
tool = IpfsPayToPinTool(mnemonic=os.environ["ALGORAND_MNEMONIC"])
```

**✅ BETTER — Use a `.env` file (add to `.gitignore`):**
```bash
# .env
ALGORAND_MNEMONIC="your 25 word mnemonic"
```

### 🛡️ Always Set a Price Cap

```python
tool = IpfsPayToPinTool(
    max_price_usdc=0.50,  # Cap at $0.50 per pin
)
```

This prevents runaway spending if your agent goes haywire.

### 🏠 Use Rekeyed Accounts for Agents

For production agents, use a **rekeyed account** so the agent can spend from its wallet but the funds owner can move them without knowing the agent's keys:

```python
client = X402Client(
    mnemonic="main_wallet_mnemonic",  # Owner's wallet
    sender="agent_address",           # Rekeyed agent address (limited)
)
```

This gives the agent spending power without exposing the main wallet's private key.

### 🧪 Use Testnet First!

Always test with the Algorand testnet before going mainnet:

```python
client = X402Client(network="testnet")  # Testnet = free ALGO faucet
```

Get free testnet ALGO from: https://bank.testnet.algonode.cloud

### 🔑 Least Privilege

- Create a dedicated wallet for each agent
- Fund it with a fixed budget (e.g., 10 USDC)
- Monitor spending regularly
- Revoke access by rekeying the wallet

## ❓ FAQ

### How much does it cost to pin a file?

Typical pinning costs between **$0.10 – $2.00 USDC** per file, depending on file size. The x402 protocol charges exactly what the storage provider demands — no hidden fees. Set `max_price_usdc` to cap your spending.

### Can my agent make its own wallet?

Yes! Your agent can generate a new Algorand wallet from a seed, derive a mnemonic, and use it as its own `sender` address:

```python
import algosdk

# Agent generates its own wallet
mnemonic = algosdk.mnemonic.generate_mnemonic()
agent_client = X402Client(
    mnemonic=mnemonic,
    network="testnet",
)
print(f"Agent wallet: {agent_client.account_address}")
```

### What happens when the 365-day pin expires?

The gateway sends a renewal reminder. Your agent can automatically renew by calling the `renewPin` method, which costs ~50% of the original pin price if renewed before expiration.

### Is x402 different from regular Algorand payments?

Yes! x402 is a **payment-protected HTTP protocol** — the server requires a signed payment transaction in the HTTP headers before serving the response. It's like a "paywall at the protocol level." Your agent's wallet signs the payment automatically — no human approval needed (unless you configure `confirm_price`).

### Can I use this with my existing AI agent framework?

Absolutely! The tools are framework-agnostic:
- **LangChain** — Direct tool integration (shown above)
- **OpenAI Function Calling** — Use the function schema (shown above)
- **AutoGPT / LangGraph** — Use as a tool in the agent's loop
- **Custom agents** — Call the Python/TypeScript client directly

### What file types are supported?

Any file! PDFs, images, JSON, text, CSVs, binaries — anything that can be base64-encoded. The gateway stores the raw bytes.

### What if my agent has an unexpected spending spree?

The `max_price_usdc` cap is your primary defense. You can also:
1. Set a `confirm_price` callback for human-in-the-loop approval
2. Use a rekeyed account with limited funds
3. Monitor the wallet and rekey if needed
4. Set wallet-level spending limits on Algorand

## 📚 Additional Resources

- [IPFS Pay-to-Pin Gateway](https://pay-to-pin.duckdns.org) — The live gateway
- [x402 Protocol Docs](https://x402.org) — Payment-protected HTTP
- [Algorand Documentation](https://developer.algorand.org) — Algorand blockchain
- [IPFS Docs](https://docs.ipfs.tech) — InterPlanetary File System
- [LangChain Tools](https://python.langchain.com/docs/modules/agents/tools/) — LangChain tooling

## 🙏 Contributing

Found a bug? Have an improvement? PRs welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## 📄 License

AGPL-3.0-or-later — see [LICENSE](../../LICENSE) for details.

---

**Happy pinning! 🕸️✨**

> "The best time to give your agent a storage wallet was yesterday. The second best time is now."
