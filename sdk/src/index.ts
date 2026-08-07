import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactAvmScheme, toClientAvmSigner, ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import algosdk from 'algosdk';
import axios from 'axios';

export interface IpfsPayToPinConfig {
  gatewayUrl?: string;
  mnemonic: string;
  algodServer?: string;
  network?: 'mainnet' | 'testnet';
  maxPriceUsdc?: number; // Optional price safety cap (default $1.00 USDC)
  confirmPrice?: (priceUsdc: number, description: string) => Promise<boolean>;
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
 * 1-Line Client SDK for IPFS Pay-to-Pin Gateway
 * Enables autonomous AI agents and applications to pin files to IPFS via Algorand microUSDC x402 payments.
 */
export class IpfsPayToPinClient {
  private gatewayUrl: string;
  private account: algosdk.Account;
  private algodClient: algosdk.Algodv2;
  private networkCaip2: string;
  private maxPriceUsdc: number;
  private confirmPrice?: (priceUsdc: number, description: string) => Promise<boolean>;
  private x402HttpClient: x402HTTPClient;
  private x402ClientInstance: x402Client;

  constructor(config: IpfsPayToPinConfig) {
    this.gatewayUrl = (config.gatewayUrl || 'https://ipfs-pay-to-pin-mainnet-c55e3346b752.herokuapp.com').replace(/\/$/, '');
    this.account = algosdk.mnemonicToSecretKey(config.mnemonic);
    const network = config.network || 'mainnet';
    this.networkCaip2 = network === 'mainnet' ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;
    const defaultAlgod = network === 'mainnet' ? 'https://mainnet-api.algonode.cloud' : 'https://testnet-api.algonode.cloud';
    this.algodClient = new algosdk.Algodv2('', config.algodServer || defaultAlgod, '');
    this.maxPriceUsdc = config.maxPriceUsdc ?? 1.0;
    this.confirmPrice = config.confirmPrice;

    const avmSigner = toClientAvmSigner(config.mnemonic);

    this.x402ClientInstance = new x402Client();
    this.x402ClientInstance.register(this.networkCaip2 as `${string}:${string}`, new ExactAvmScheme(avmSigner as any));
    this.x402HttpClient = new x402HTTPClient(this.x402ClientInstance);
  }

  public getAddress(): string {
    return this.account.addr.toString();
  }

  /**
   * Pin a file payload to IPFS for 365 days using an Algorand microUSDC x402 payment.
   *
   * @param options - The file data and filename to pin.
   * @returns A promise resolving to the pin confirmation details, including CID and gateway URL.
   * @throws {InsufficientBudgetError} If the 402 challenge price exceeds `maxPriceUsdc`.
   * @throws {PaymentDeclinedError} If the `confirmPrice` callback returns false.
   * @throws {Error} If the upload request fails for network or unexpected server errors.
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

    // 2. Parse price from 402 challenge
    const challenge = this.x402HttpClient.getPaymentRequiredResponse((h) => res402.headers[h.toLowerCase()]);
    const accepts = (challenge as any)?.accepts?.[0];
    const amountMicroUsdc = parseInt(accepts?.amount || '10000', 10);
    const priceUsdc = amountMicroUsdc / 1_000_000;

    // 3. Confirm / Deny price checks
    if (priceUsdc > this.maxPriceUsdc) {
      throw new InsufficientBudgetError(`Payment rejected: Price ($${priceUsdc} USDC) exceeds configured max price cap ($${this.maxPriceUsdc} USDC).`);
    }

    if (this.confirmPrice) {
      const approved = await this.confirmPrice(priceUsdc, options.filename);
      if (!approved) {
        throw new PaymentDeclinedError(`Payment declined: User rejected price of $${priceUsdc} USDC for ${options.filename}.`);
      }
    }

    // 4. Sign payment transaction & construct x402 header
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
   * @param cid - The IPFS CID to check retention status for.
   * @returns A promise resolving to the active status and days remaining.
   */
  public async getPinStatus(cid: string): Promise<PinStatusResponse> {
    const res = await axios.get(`${this.gatewayUrl}/api/v1/pin/${encodeURIComponent(cid)}`);
    return res.data;
  }

  /**
   * Renew an existing pin for another 365 days (50% early renewal discount applies before expiration).
   *
   * @param cid - The IPFS CID to renew.
   * @returns A promise resolving to the updated expiration details.
   * @throws {InsufficientBudgetError} If the 402 challenge price exceeds `maxPriceUsdc`.
   * @throws {PaymentDeclinedError} If the `confirmPrice` callback returns false.
   * @throws {Error} If the renewal request fails for network or unexpected server errors.
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
    const accepts = (challenge as any)?.accepts?.[0];
    const amountMicroUsdc = parseInt(accepts?.amount || '5000', 10);
    const priceUsdc = amountMicroUsdc / 1_000_000;

    if (priceUsdc > this.maxPriceUsdc) {
      throw new InsufficientBudgetError(`Renewal rejected: Price ($${priceUsdc} USDC) exceeds configured max price cap ($${this.maxPriceUsdc} USDC).`);
    }

    if (this.confirmPrice) {
      const approved = await this.confirmPrice(priceUsdc, `Renewal for CID ${cid}`);
      if (!approved) {
        throw new PaymentDeclinedError(`Renewal declined: User rejected renewal price of $${priceUsdc} USDC.`);
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
