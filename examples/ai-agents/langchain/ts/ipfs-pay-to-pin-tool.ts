/**
 * LangChain Tool for IPFS Pay-to-Pin (x402)
 *
 * A LangChain Tool that wraps the `ipfs-pay-to-pin-client` TypeScript SDK,
 * enabling AI agents to autonomously pin files to IPFS using Algorand
 * microUSDC x402 micropayments.
 *
 * Installation:
 *   npm install ipfs-pay-to-pin-client @langchain/core
 *
 * Usage:
 *   import { IpfsPayToPinTool } from './ipfs-pay-to-pin-tool';
 *
 *   const tool = new IpfsPayToPinTool({
 *     mnemonic: process.env.ALGORAND_MNEMONIC!,
 *     network: 'testnet',
 *     maxPriceUsdc: 1.0,
 *   });
 *
 *   const result = await tool.invoke({
 *     filename: 'hello.txt',
 *     fileData: Buffer.from('Hello, World!'),
 *   });
 *   console.log(result);
 */

import { Tool } from '@langchain/core/tools';
import { IpfsPayToPinClient, InsufficientBudgetError, PaymentDeclinedError } from 'ipfs-pay-to-pin-client';

export interface IpfsPayToPinToolOptions {
  /** Algorand wallet mnemonic (25 words) or base64-encoded private key */
  mnemonic: string;
  /** Gateway URL — defaults to mainnet Pay-to-Pin gateway */
  gatewayUrl?: string;
  /** Rekeyed wallet address for agent-controlled spending (optional) */
  sender?: string;
  /** Network: 'mainnet' or 'testnet' */
  network?: 'mainnet' | 'testnet';
  /** Maximum price in USDC for a single pin operation (default: 1.0) */
  maxPriceUsdc?: number;
  /** Optional human-in-the-loop price confirmation callback */
  confirmPrice?: (priceUsdc: number, filename: string) => Promise<boolean>;
}

export interface IpfsPayToPinInput {
  /** Name of the file to upload (e.g., 'report.pdf') */
  filename: string;
  /** File content as Buffer or base64-encoded string */
  fileData: Buffer | string;
}

/**
 * LangChain Tool for pinning files to IPFS via x402 micropayments.
 *
 * This tool enables AI agents to autonomously:
 * - Upload files to the IPFS Pay-to-Pin gateway
 * - Pay with Algorand microUSDC via x402
 * - Receive back the IPFS CID and gateway URL
 *
 * The tool handles the full x402 payment flow transparently,
 * including budget caps and optional price confirmation.
 */
export class IpfsPayToPinTool extends Tool {
  static name = 'ipfs_pin_file';

  name = 'ipfs_pin_file';

  description =
    'Upload a file to IPFS using pay-to-pin. Takes filename and file content (Buffer or base64 string), ' +
    'returns IPFS CID and gateway URL. The file is pinned for 365 days with a microUSDC x402 payment. ' +
    'Set maxPriceUsdc to cap spending per upload.';

  private client: IpfsPayToPinClient;

  constructor(options: IpfsPayToPinToolOptions) {
    super();
    this.client = new IpfsPayToPinClient({
      mnemonic: options.mnemonic,
      gatewayUrl: options.gatewayUrl,
      sender: options.sender,
      network: options.network ?? 'mainnet',
      maxPriceUsdc: options.maxPriceUsdc ?? 1.0,
      confirmPrice: options.confirmPrice,
    });
  }

  /**
   * Invoke the tool with filename and file data.
   * @param input - Object with filename and fileData properties
   * @returns A string describing the pin operation result
   */
  protected async _call(input: IpfsPayToPinInput): Promise<string> {
    try {
      const result = await this.client.pinFile({
        filename: input.filename,
        data: typeof input.fileData === 'string' ? input.fileData : Buffer.from(input.fileData),
      });

      return (
        `Successfully pinned '${result.filename}' to IPFS!\n` +
        `CID: ${result.ipfs_cid}\n` +
        `Gateway URL: ${result.gateway_url}\n` +
        `Status: ${result.status}\n` +
        `Pinned At: ${result.pinned_at}\n` +
        `Expires At: ${result.expires_at} (${result.ttl_days} days)`
      );
    } catch (error) {
      if (error instanceof InsufficientBudgetError) {
        return `ERROR: Budget exceeded — ${error.message}`;
      }
      if (error instanceof PaymentDeclinedError) {
        return `ERROR: Payment declined — ${error.message}`;
      }
      return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Convenience factory to create a configured IpfsPayToPinTool instance.
 *
 * @example
 * ```typescript
 * import { createIpfsTool } from './ipfs-pay-to-pin-tool';
 *
 * const tool = createIpfsTool({
 *   mnemonic: process.env.ALGORAND_MNEMONIC!,
 *   network: 'testnet',
 *   maxPriceUsdc: 0.50,
 * });
 * ```
 */
export function createIpfsTool(options: IpfsPayToPinToolOptions): IpfsPayToPinTool {
  return new IpfsPayToPinTool(options);
}
