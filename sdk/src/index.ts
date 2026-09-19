import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactAvmScheme, toClientAvmSigner, ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import algosdk from 'algosdk';
import axios from 'axios';

/**
 * The maximum permitted request payload size (20MB) supported by the gateway.
 */
export const MAX_PAYLOAD_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * Configuration options for initializing the IPFS Pay-to-Pin client.
 * Requires at least one valid signing method (mnemonic, evmPrivateKey, or solanaPrivateKey).
 */
export interface IpfsPayToPinConfig {
  /** The URL of the IPFS Pay-to-Pin Gateway. Defaults to https://pay-to-pin.duckdns.org */
  gatewayUrl?: string;
  /** Algorand 25-word mnemonic or base64 secret key for Algorand payments. */
  mnemonic?: string;
  /** EVM private key (0x...) for Base, Arbitrum, or Ethereum L1 gasless or native USDC payments. */
  evmPrivateKey?: string;
  /** Solana base58 private key or raw secret key for Solana mainnet USDC payments. */
  solanaPrivateKey?: string;
  /** Original asset holding account address (required if using a rekeyed Algorand signer). */
  sender?: string;
  /** Custom Algorand algod node URL. Defaults to Algonode public API. */
  algodServer?: string;
  /** Network environment for Algorand operations. Defaults to 'mainnet'. */
  network?: 'mainnet' | 'testnet';
  /** Preferred network CAIP-2 identifier to prioritize during 402 payment resolution (e.g. "eip155:8453" for Base). */
  preferredNetwork?: string;
  /** Maximum price budget cap in USDC (default: $1.00 USDC) to prevent unexpected overcharging. */
  maxPriceUsdc?: number;
  /** Optional callback to manually approve or decline payments dynamically before execution. */
  confirmPrice?: (priceUsdc: number, description: string, network: string) => Promise<boolean>;
}

/**
 * Payload configuration for uploading and pinning a file.
 */
export interface PinOptions {
  /** The name of the file to store (e.g., 'document.pdf'). */
  filename: string;
  /** The file contents as a raw Buffer or a Base64 encoded string. */
  data: Buffer | string;
}

/**
 * The standard response returned by the gateway after a successful file pin payment.
 */
export interface PinResponse {
  /** HTTP status descriptor (e.g., 'success'). */
  status: string;
  /** Detailed result message. */
  message: string;
  /** The original filename supplied during upload. */
  filename: string;
  /** The IPFS CID for the pinned file. */
  ipfs_cid: string;
  /** Alias for ipfs_cid. */
  cid: string;
  /** The public gateway URL to immediately access the pinned file. */
  gateway_url: string;
  /** ISO timestamp denoting when the file was pinned. */
  pinned_at: string;
  /** ISO timestamp denoting when the 365-day retention period expires. */
  expires_at: string;
  /** Time-to-live length in days (e.g., 365). */
  ttl_days: number;
  /** The API URL to renew this pin for an additional year. */
  renewal_url: string;
}

/**
 * Free-tier retention status information for an existing pinned CID.
 */
export interface PinStatusResponse {
  /** ISO timestamp denoting when the file was initially pinned. */
  pinned_at: string;
  /** ISO timestamp denoting when the retention period expires. */
  expires_at: string;
  /** The calculated number of days remaining until the file is unpinned. */
  days_remaining: number;
  /** Boolean indicating whether the pin is currently active or expired. */
  is_active: boolean;
  /** Total Time-to-live length in days initially purchased. */
  ttl_days: number;
  /** The number of times this pin has been renewed. */
  renewals_count: number;
  /** The API URL to renew this pin for an additional year. */
  renewal_url: string;
}

/**
 * The response returned after successfully renewing an existing pin.
 */
export interface RenewResponse {
  /** HTTP status descriptor. */
  status: string;
  /** Detailed result message confirming renewal. */
  message: string;
  /** The IPFS CID that was renewed. */
  cid: string;
  /** The new ISO timestamp denoting the extended expiration date. */
  expires_at: string;
  /** The updated total number of renewals applied to this CID. */
  renewals_count: number;
}

/**
 * Error thrown when a requested payment amount exceeds the maximum configured price budget cap (maxPriceUsdc).
 */
export class InsufficientBudgetError extends Error {
  /**
   * Constructs an InsufficientBudgetError.
   * @param {string} message - The error message detailing the budget failure.
   */
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBudgetError';
    Object.setPrototypeOf(this, InsufficientBudgetError.prototype);
  }
}

/**
 * Error thrown when a custom `confirmPrice` callback rejects a payment by returning `false`.
 */
export class PaymentDeclinedError extends Error {
  /**
   * Constructs a PaymentDeclinedError.
   * @param {string} message - The error message detailing the declined payment.
   */
  constructor(message: string) {
    super(message);
    this.name = 'PaymentDeclinedError';
    Object.setPrototypeOf(this, PaymentDeclinedError.prototype);
  }
}

/**
 * Error thrown when the SDK is misconfigured or when invalid inputs are provided to client methods.
 */
export class ConfigurationError extends Error {
  /**
   * Constructs a ConfigurationError.
   * @param {string} message - The error message detailing the configuration or input failure.
   */
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Error thrown when the IPFS Pay-to-Pin gateway returns an HTTP error or when network issues occur.
 * Includes an optional HTTP status code.
 */
export class GatewayError extends Error {
  /** The optional HTTP status code returned by the gateway. */
  public status?: number;

  /**
   * Constructs a GatewayError.
   * @param {string} message - The error message detailing the gateway failure.
   * @param {number} [status] - Optional HTTP status code associated with the error.
   */
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
    Object.setPrototypeOf(this, GatewayError.prototype);
  }
}

/**
 * 1-Line Multi-Chain Client SDK for IPFS Pay-to-Pin Gateway
 * Enables autonomous AI agents and applications to pin files to IPFS via Base L2, Solana, or Algorand microUSDC x402 payments.
 */
export class IpfsPayToPinClient {
  private gatewayUrl: string;
  private algorandAccount?: algosdk.Account;
  private sender?: string;
  private algodClient: algosdk.Algodv2;
  private networkCaip2: string;
  private preferredNetwork?: string;
  private maxPriceUsdc: number;
  private confirmPrice?: (priceUsdc: number, description: string, network: string) => Promise<boolean>;
  private x402HttpClient: x402HTTPClient;
  private x402ClientInstance: x402Client;
  private registeredNetworks: Set<string> = new Set();
  private registeredNetworksArr: string[] = [];

  /**
   * Initializes a new instance of the IpfsPayToPinClient.
   * Requires at least one valid signing method (mnemonic, evmPrivateKey, or solanaPrivateKey) to be provided in the configuration.
   *
   * @param config - The configuration options for the client.
   * @throws {ConfigurationError} If the client is initialized without at least one valid wallet key.
   */
  constructor(config: IpfsPayToPinConfig) {
    if (!config.mnemonic && !config.evmPrivateKey && !config.solanaPrivateKey) {
      throw new ConfigurationError('IpfsPayToPinClient requires at least one wallet key (mnemonic, evmPrivateKey, or solanaPrivateKey).');
    }

    this.sender = config.sender;
    this.gatewayUrl = (config.gatewayUrl || 'https://pay-to-pin.duckdns.org').replace(/\/$/, '');
    this.preferredNetwork = config.preferredNetwork;
    this.maxPriceUsdc = config.maxPriceUsdc ?? 1.0;
    this.confirmPrice = config.confirmPrice;

    const network = config.network || 'mainnet';
    this.networkCaip2 = network === 'mainnet' ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;
    const defaultAlgod = network === 'mainnet' ? 'https://mainnet-api.algonode.cloud' : 'https://testnet-api.algonode.cloud';
    this.algodClient = new algosdk.Algodv2('', config.algodServer || defaultAlgod, '');

    this.x402ClientInstance = new x402Client();

    // 1. Register Algorand AVM Signer if mnemonic provided
    if (config.mnemonic) {
      let secretKeyB64 = config.mnemonic;
      if (config.mnemonic.includes(' ')) {
        const words = config.mnemonic.trim().split(/\s+/);
        if (words.length !== 25) {
          throw new ConfigurationError(`[IpfsClient] Invalid mnemonic: Expected 25 words, got ${words.length}`);
        }
        try {
          this.algorandAccount = algosdk.mnemonicToSecretKey(config.mnemonic);
          secretKeyB64 = Buffer.from(this.algorandAccount.sk).toString('base64');
        } catch (err: any) {
          throw new ConfigurationError(`[IpfsClient] Failed to parse Algorand mnemonic: ${err?.message || 'Invalid checksum or format'}`);
        }
      } else {
        const skBytes = Buffer.from(config.mnemonic, 'base64');
        this.algorandAccount = typeof algosdk.secretKeyToMnemonic === 'function' ? { addr: algosdk.encodeAddress(skBytes.subarray(32)), sk: skBytes } as any : { addr: '', sk: skBytes } as any;
      }

      let avmSigner;
      if (config.sender) {
        const authAccount = this.algorandAccount;
        if (!authAccount) {
          throw new ConfigurationError('Mnemonic required when specifying sender.');
        }
        avmSigner = {
          address: config.sender,
          signTransactions: async (transactions: Uint8Array[], indexesToSign?: number[]) => {
            return transactions.map((txnBytes, i) => {
              if (indexesToSign && !indexesToSign.includes(i)) return null;
              const txn = algosdk.decodeUnsignedTransaction(txnBytes);
              return txn.signTxn(authAccount.sk);
            });
          }
        };
      } else {
        avmSigner = toClientAvmSigner(secretKeyB64);
      }

      this.x402ClientInstance.register(this.networkCaip2 as `${string}:${string}`, new ExactAvmScheme(avmSigner as any));
      const fullCaip2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=';
      this.x402ClientInstance.register(fullCaip2 as `${string}:${string}`, new ExactAvmScheme(avmSigner as any));
      this.registeredNetworks.add(this.networkCaip2);
      this.registeredNetworks.add('algorand:mainnet');
    }

    // 2. Register EVM Signer if evmPrivateKey provided
    if (config.evmPrivateKey) {
      const formattedKey = config.evmPrivateKey.startsWith('0x') ? config.evmPrivateKey : `0x${config.evmPrivateKey}`;
      const evmScheme = new ExactEvmScheme(formattedKey as any);
      this.x402ClientInstance.register('eip155:8453', evmScheme); // Base L2
      this.x402ClientInstance.register('eip155:42161', evmScheme); // Arbitrum One
      this.x402ClientInstance.register('eip155:1', evmScheme); // Ethereum L1
      this.registeredNetworks.add('eip155:8453');
      this.registeredNetworks.add('eip155:42161');
      this.registeredNetworks.add('eip155:1');
    }

    // 3. Register Solana Signer if solanaPrivateKey provided
    if (config.solanaPrivateKey) {
      const solanaScheme = new ExactSvmScheme(config.solanaPrivateKey as any);
      const solanaCaip2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
      this.x402ClientInstance.register(solanaCaip2 as `${string}:${string}`, solanaScheme);
      this.registeredNetworks.add(solanaCaip2);
    }

    this.x402HttpClient = new x402HTTPClient(this.x402ClientInstance);
    this.registeredNetworksArr = Array.from(this.registeredNetworks);
  }

  /**
   * Returns the primary wallet address used by the client for payments.
   * Returns the explicit `sender` if configured, the derived Algorand account address if initialized with a mnemonic,
   * or a generic 'multi-chain-wallet' string for purely EVM/Solana configured clients.
   *
   * @returns {string} The public address or a generic identifier.
   */
  public getAddress(): string {
    if (this.sender || this.algorandAccount) {
      return this.sender || this.algorandAccount!.addr.toString();
    }
    return 'multi-chain-wallet';
  }

  /**
   * Select best network choice from 402 accepts[] challenge based on registered signers and price.
   */
  private selectBestAcceptOption(challenge: any): any {
    const accepts: any[] = challenge?.accepts || [];
    if (!accepts.length) {
      throw new GatewayError('Invalid 402 challenge: No accepts options found.');
    }

    // Filter to options where we have a registered signer
    // ⚡ Bolt: Use globally pre-allocated array of registered networks (created once in constructor)
    // instead of calling Array.from() on the Set on every client request to prevent O(N) memory allocations
    const validOptions = accepts.filter(opt => {
      const net = opt.network || '';
      return this.registeredNetworks.has(net) || this.registeredNetworksArr.some(rn => net.startsWith(rn));
    });

    if (!validOptions.length) {
      throw new ConfigurationError(`Client wallet lacks registered signers for available challenge networks (${accepts.map(a => a.network).join(', ')}).`);
    }

    // Priority 1: User's explicit preferredNetwork if available
    if (this.preferredNetwork) {
      const prefMatch = validOptions.find(opt => opt.network === this.preferredNetwork);
      if (prefMatch) return prefMatch;
    }

    // Priority 2: Lowest-cost microUSDC / gasless choice (Base L2 > Solana > Algorand > Ethereum L1)
    const networkPriority: Record<string, number> = {
      'eip155:8453': 1, // Base L2 (Gasless EIP-3009)
      'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 2,
      'algorand:mainnet': 3,
      [ALGORAND_MAINNET_CAIP2]: 3,
      'eip155:42161': 4, // Arbitrum One
      'eip155:1': 5 // Ethereum L1
    };

    validOptions.sort((a, b) => {
      const priceA = parseInt(a.amount || '0', 10);
      const priceB = parseInt(b.amount || '0', 10);
      if (priceA !== priceB) return priceA - priceB;
      const prioA = networkPriority[a.network] || 99;
      const prioB = networkPriority[b.network] || 99;
      return prioA - prioB;
    });

    return validOptions[0];
  }

  /**
   * Pins a file payload to IPFS for 365 days using an automated multi-chain microUSDC x402 payment.
   *
   * @param options - Configuration for the file to pin (filename and buffer/string data).
   * @returns {Promise<PinResponse>} Returns pinned CID, gateway URL, and expiration data.
   * @throws {ConfigurationError} If inputs are missing or invalid.
   * @throws {GatewayError} If network fails or gateway returns unexpected status.
   * @throws {InsufficientBudgetError} If requested x402 payment price exceeds `maxPriceUsdc`.
   * @throws {PaymentDeclinedError} If user explicit `confirmPrice` callback rejects payment.
   *
   * @example
   * const client = new IpfsPayToPinClient({ mnemonic: process.env.MNEMONIC });
   * const result = await client.pinFile({ filename: 'test.txt', data: Buffer.from('hello world') });
   * console.log('Pinned to', result.ipfs_cid);
   */
  public async pinFile(options: PinOptions): Promise<PinResponse> {
    if (!options || !options.filename || !options.data) {
      throw new ConfigurationError('[IpfsClient] Missing required pinFile options (filename or data).');
    }

    if (typeof options.data !== 'string' && !Buffer.isBuffer(options.data)) {
      throw new ConfigurationError(`[IpfsClient] Expected options.data to be a Buffer or string, got ${typeof options.data}`);
    }

    const estimatedSize = typeof options.data === 'string'
      ? options.data.length
      : Math.ceil(options.data.byteLength * 4 / 3);

    // We leave a small 10KB buffer for JSON structure (filename, etc)
    if (estimatedSize > MAX_PAYLOAD_SIZE_BYTES - 10240) {
      throw new ConfigurationError(`[IpfsClient] File payload size (${estimatedSize} bytes) exceeds the 20MB gateway limit.`);
    }

    const base64Data = typeof options.data === 'string'
      ? options.data
      : options.data.toString('base64');

    const pinUrl = `${this.gatewayUrl}/api/v1/pin`;
    const payload = { filename: options.filename, data: base64Data };

    // 1. Initial request to get 402 challenge
    let res402: any;
    try {
      const directRes = await axios.post(pinUrl, payload);
      return directRes.data;
    } catch (err: any) {
      if (err.response && err.response.status === 402) {
        res402 = err.response;
      } else {
        throw new GatewayError(`Upload request failed (${err?.response?.status || 'network error'}): ${err?.response?.data?.message || err?.message}`, err?.response?.status);
      }
    }

    // 2. Parse multi-chain challenge & select network
    const challenge = this.x402HttpClient.getPaymentRequiredResponse((h) => res402.headers[h.toLowerCase()]);
    const selectedAccept = this.selectBestAcceptOption(challenge);
    const amountMicroUsdc = parseInt(selectedAccept?.amount || '10000', 10);
    const priceUsdc = amountMicroUsdc / 1_000_000;
    const selectedNetwork = selectedAccept?.network || 'unknown';

    // 3. Confirm / Deny price checks
    if (priceUsdc > this.maxPriceUsdc) {
      throw new InsufficientBudgetError(`Payment rejected: Price ($${priceUsdc} USDC on ${selectedNetwork}) exceeds configured max price cap ($${this.maxPriceUsdc} USDC).`);
    }

    if (this.confirmPrice) {
      const approved = await this.confirmPrice(priceUsdc, options.filename, selectedNetwork);
      if (!approved) {
        throw new PaymentDeclinedError(`Payment declined: User rejected price of $${priceUsdc} USDC on ${selectedNetwork} for ${options.filename}.`);
      }
    }

    // 4. Sign payment transaction on selected chain & construct x402 header
    const paymentPayload = await this.x402ClientInstance.createPaymentPayload(challenge as any);
    const paymentHeaders = this.x402HttpClient.encodePaymentSignatureHeader(paymentPayload);

    // 5. Submit paid request
    const paidRes = await axios.post(pinUrl, payload, {
      headers: {
        ...paymentHeaders
      }
    });

    return paidRes.data;
  }

  /**
   * Free retention status lookup for a pinned CID.
   *
   * @param cid - The IPFS CID to check (e.g., 'bafybeig...').
   * @returns {Promise<PinStatusResponse>} Current pin status, expiration, and remaining days.
   * @throws {GatewayError} If the network fails, CID is not found (404), or gateway returns an unexpected status.
   *
   * @example
   * const status = await client.getPinStatus('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
   * console.log(status.is_active ? 'Pin is active' : 'Pin is expired');
   */
  public async getPinStatus(cid: string): Promise<PinStatusResponse> {
    try {
      const res = await axios.get(`${this.gatewayUrl}/api/v1/pin/${encodeURIComponent(cid)}`);
      return res.data;
    } catch (err: any) {
      throw new GatewayError(`Status lookup failed for CID ${cid} (${err?.response?.status || 'network error'}): ${err?.response?.data?.error || err?.response?.data?.message || err?.message}`, err?.response?.status);
    }
  }

  /**
   * Renews an existing pinned CID for another 365 days.
   * Note: A 50% early renewal discount applies before original expiration.
   *
   * @param cid - The IPFS CID to renew (e.g. 'bafybeig...').
   * @returns {Promise<RenewResponse>} Status, expiration details, and renewal count.
   * @throws {GatewayError} If network fails or gateway returns unexpected status.
   * @throws {InsufficientBudgetError} If requested x402 renewal price exceeds `maxPriceUsdc`.
   * @throws {PaymentDeclinedError} If user explicit `confirmPrice` callback rejects renewal.
   *
   * @example
   * const result = await client.renewPin('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
   * console.log('Renewed until:', result.expires_at);
   */
  public async renewPin(cid: string): Promise<RenewResponse> {
    const renewUrl = `${this.gatewayUrl}/api/v1/renew`;
    const payload = { cid };

    let res402: any;
    try {
      const directRes = await axios.post(renewUrl, payload);
      return directRes.data;
    } catch (err: any) {
      if (err.response && err.response.status === 402) {
        res402 = err.response;
      } else {
        throw new GatewayError(`Renewal request failed (${err?.response?.status}): ${err?.response?.data?.message || err?.message}`, err?.response?.status);
      }
    }

    const challenge = this.x402HttpClient.getPaymentRequiredResponse((h) => res402.headers[h.toLowerCase()]);
    const selectedAccept = this.selectBestAcceptOption(challenge);
    const amountMicroUsdc = parseInt(selectedAccept?.amount || '5000', 10);
    const priceUsdc = amountMicroUsdc / 1_000_000;
    const selectedNetwork = selectedAccept?.network || 'unknown';

    if (priceUsdc > this.maxPriceUsdc) {
      throw new InsufficientBudgetError(`Renewal rejected: Price ($${priceUsdc} USDC on ${selectedNetwork}) exceeds configured max price cap ($${this.maxPriceUsdc} USDC).`);
    }

    if (this.confirmPrice) {
      const approved = await this.confirmPrice(priceUsdc, `Renewal for CID ${cid}`, selectedNetwork);
      if (!approved) {
        throw new PaymentDeclinedError(`Renewal declined: User rejected renewal price of $${priceUsdc} USDC on ${selectedNetwork}.`);
      }
    }

    const paymentPayload = await this.x402ClientInstance.createPaymentPayload(challenge as any);
    const paymentHeaders = this.x402HttpClient.encodePaymentSignatureHeader(paymentPayload);

    const paidRes = await axios.post(renewUrl, payload, {
      headers: {
        ...paymentHeaders
      }
    });

    return paidRes.data;
  }
}

