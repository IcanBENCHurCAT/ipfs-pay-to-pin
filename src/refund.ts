import algosdk from 'algosdk';
import { config } from './config.js';

export interface RefundParams {
  recipientAddress: string;
  amountMicroUsdc: number;
  asaId: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  txId?: string;
  error?: string;
}

/**
 * Initiates an on-chain Algorand microUSDC refund transaction back to the client.
 * Feature-flagged behind process.env.ENABLE_AUTOMATIC_REFUNDS === 'true'.
 */
export async function initiateOnChainRefund(params: RefundParams): Promise<RefundResult> {
  if (!config.enableAutomaticRefunds) {
    console.log('[Refund] Automatic refunds feature flag (ENABLE_AUTOMATIC_REFUNDS) is disabled.');
    return { success: false, error: 'Automatic refunds feature flag is disabled.' };
  }

  if (!params.recipientAddress || !algosdk.isValidAddress(params.recipientAddress)) {
    console.warn(`[Refund] Invalid Algorand recipient address: "${params.recipientAddress}"`);
    return { success: false, error: `Invalid Algorand recipient address: ${params.recipientAddress}` };
  }

  const mnemonic = config.algorandMnemonic;
  if (!mnemonic || mnemonic.trim().length === 0) {
    console.warn('[Refund] Cannot execute on-chain refund: ALGORAND_WALLET_MNEMONIC is not configured.');
    return { success: false, error: 'Escrow wallet mnemonic is missing.' };
  }

  try {
    const algodClient = new algosdk.Algodv2('', config.algorandServer, '');
    const account = algosdk.mnemonicToSecretKey(mnemonic.trim());
    const suggestedParams = await algodClient.getTransactionParams().do();

    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: account.addr,
      receiver: params.recipientAddress,
      amount: params.amountMicroUsdc,
      assetIndex: params.asaId,
      suggestedParams,
      note: new Uint8Array(Buffer.from(`x402-refund: ${params.reason || 'Pinning failure refund'}`)),
    });

    const signedTxn = txn.signTxn(account.sk);
    const sendResult = await algodClient.sendRawTransaction(signedTxn).do();
    const txId = (sendResult as any)?.txid || (sendResult as any)?.txId || sendResult;

    console.log(`[Refund] Initiated on-chain refund of ${params.amountMicroUsdc} microUSDC to ${params.recipientAddress} (TxID: ${txId})`);

    await algosdk.waitForConfirmation(algodClient, txId, 4);

    return {
      success: true,
      txId,
    };
  } catch (err: any) {
    console.error(`[Refund Error] Failed to execute refund to ${params.recipientAddress}:`, err?.message || err);
    return {
      success: false,
      error: err?.message || 'Refund transaction execution failed.',
    };
  }
}
