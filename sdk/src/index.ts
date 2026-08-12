import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactAvmScheme, toClientAvmSigner, ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import algosdk from 'algosdk';
import axios from 'axios';

export interface IpfsPayToPinConfig {
  gatewayUrl?: string;
  mnemonic?: string; // Algorand 25-word mnemonic or base64 secret key
  evmPrivateKey?: string; // EVM private key (0x...) for Base / L2 / L1
  solanaPrivateKey?: string; // Solana base58 private key or raw secret key
  sender?: string; // Original asset holding account address (if using a rekeyed Algorand signer)
  algodServer?: string;
  network?: 'mainnet' | 'testnet';
  preferredNetwork?: string; // e.g. "eip155:8453" (Base), "solana:5ey...", "algorand:mainnet"
  maxPriceUsdc?: number; // Optional price safety cap (default $1.00 USDC)
  confirmPrice?: (priceUsdc: number, description: string, network: string) => Promise<boolean>;
}

export interface PinOptions {
  filename: string;
  data: Buffer | string;
}

export interface PinResponse {
  status: string;
  message: string;
  filename: string;
  ipfs_cid: string;
  cid: string;
  gateway_url: string;
  pinned_at: string;
  expires_at: string;
  ttl_days: number;
  renewal_url: string;
}

export interface PinStatusResponse {
  pinned_at: string;
  expires_at: string;
  days_remaining: number;
  is_active: boolean;
  ttl_days: number;
  renewals_count: number;
  renewal_url: string;
}

export interface RenewResponse {
  status: string;
  message: string;
  cid: string;
  expires_at: string;
  renewals_count: number;
}

export class InsufficientBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBudgetError';
    Object.setPrototypeOf(this, InsufficientBudgetError.prototype);
  }
}

export class PaymentDeclinedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentDeclinedError';
    Object.setPrototypeOf(this, PaymentDeclinedError.prototype);
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

  constructor(config: IpfsPayToPinConfig) {
    if (!config.mnemonic && !config.evmPrivateKey && !config.solanaPrivateKey) {
      throw new Error('IpfsPayToPinClient requires at least one wallet key (mnemonic, evmPrivateKey, or solanaPrivateKey).');
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
        this.algorandAccount = algosdk.mnemonicToSecretKey(config.mnemonic);
        secretKeyB64 = Buffer.from(this.algorandAccount.sk).toString('base64');
      } else {
        const skBytes = Buffer.from(config.mnemonic, 'base64');
        this.algorandAccount = typeof algosdk.secretKeyToMnemonic === 'function' ? { addr: algosdk.encodeAddress(skBytes.subarray(32)), sk: skBytes } as any : { addr: '', sk: skBytes } as any;
      }

      let avmSigner;
      if (config.sender) {
        const authAccount = this.algorandAccount;
        if (!authAccount) {
          throw new Error('Mnemonic required when specifying sender.');
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
  }

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
      throw new Error('Invalid 402 challenge: No accepts options found.');
    }

    // Filter to options where we have a registered signer
    const validOptions = accepts.filter(opt => {
      const net = opt.network || '';
      return this.registeredNetworks.has(net) || Array.from(this.registeredNetworks).some(rn => net.startsWith(rn));
    });

    if (!validOptions.length) {
      throw new Error(`Client wallet lacks registered signers for available challenge networks (${accepts.map(a => a.network).join(', ')}).`);
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
   * Pin a file payload to IPFS for 365 days using a multi-chain microUSDC x402 payment.
   */
  public async pinFile(options: PinOptions): Promise<PinResponse> {
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
        throw new Error(`Upload request failed (${err?.response?.status || 'network error'}): ${err?.response?.data?.message || err?.message}`);
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
   */
  public async getPinStatus(cid: string): Promise<PinStatusResponse> {
    const res = await axios.get(`${this.gatewayUrl}/api/v1/pin/${encodeURIComponent(cid)}`);
    return res.data;
  }

  /**
   * Renew an existing pin for another 365 days (50% early renewal discount applies before expiration).
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
        throw new Error(`Renewal request failed (${err?.response?.status}): ${err?.response?.data?.message || err?.message}`);
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

