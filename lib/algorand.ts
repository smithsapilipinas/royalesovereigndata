/**
 * ROYALE — ALGORAND INTEGRATION
 *
 * Algorand is the primary chain for Royale:
 *   - Fast (4s finality), cheap ($0.001 tx), carbon-negative
 *   - ARC-20 = Algorand Standard Asset (ASA) version of $RYL
 *   - Native ALGO payments for content purchase
 *   - PyTEAL smart contracts for subscription management
 *
 * Why Algorand:
 *   - No gas wars
 *   - Pure Proof-of-Stake (sovereign, not miner-captured)
 *   - 1000+ TPS — handles creator economy at scale
 *   - Pera Wallet = best UX for creators
 */

import algosdk from 'algosdk';

// ─── CONFIGURATION ───────────────────────────────────────────────────────────

const ALGO_NODE = process.env.ALGORAND_NODE_URL || 'https://mainnet-api.algonode.cloud';
const ALGO_INDEXER = process.env.ALGORAND_INDEXER_URL || 'https://mainnet-idx.algonode.cloud';
const ROYALE_ASSET_ID = parseInt(process.env.NEXT_PUBLIC_ROYALE_ASSET_ID || '0');
const ROYALE_TAX_ADDRESS = process.env.ROYALE_TREASURY_ALGO || '';

const algodClient = new algosdk.Algodv2('', ALGO_NODE, '');
const indexerClient = new algosdk.Indexer('', ALGO_INDEXER, '');

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export interface AlgoPayment {
  txId: string;
  from: string;
  to: string;
  amount: number; // in microALGO
  note?: string;
  confirmedRound?: number;
}

export interface ContentPurchaseTx {
  contentId: string;
  buyer: string;
  creator: string;
  priceMicroAlgo: number;
  taxMicroAlgo: number;
  creatorCutMicroAlgo: number;
  ipfsCid: string;
}

// ─── PAYMENT UTILITIES ───────────────────────────────────────────────────────

/**
 * Get suggested transaction params (gas-equivalent for Algorand)
 */
export async function getSuggestedParams(): Promise<algosdk.SuggestedParams> {
  return algodClient.getTransactionParams().do();
}

/**
 * Build content purchase transaction group
 * Atomic group: [buyer→creator 95%, buyer→treasury 5%]
 * Both succeed or both fail — no partial payments
 */
export async function buildContentPurchaseTxGroup(
  params: ContentPurchaseTx
): Promise<Uint8Array[]> {
  const suggestedParams = await getSuggestedParams();

  const tax = Math.floor(params.priceMicroAlgo * 0.05);
  const creatorCut = params.priceMicroAlgo - tax;

  const noteText = JSON.stringify({
    royale: '1.0',
    contentId: params.contentId,
    ipfsCid: params.ipfsCid,
    type: 'content_purchase',
  });
  const note = new TextEncoder().encode(noteText);

  // Tx 1: Buyer → Creator (95%)
  const creatorTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: params.buyer,
    to: params.creator,
    amount: creatorCut,
    note,
    suggestedParams,
  });

  // Tx 2: Buyer → Treasury (5% Royale tax)
  const taxTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: params.buyer,
    to: ROYALE_TAX_ADDRESS,
    amount: tax,
    note: new TextEncoder().encode(`royale_tax_${params.contentId}`),
    suggestedParams,
  });

  // Group them atomically
  const group = [creatorTx, taxTx];
  algosdk.assignGroupID(group);

  return group.map(tx => tx.toByte());
}

/**
 * Build $RYL (ASA) transfer transaction for content purchase
 */
export async function buildRYLPurchaseTx(
  buyer: string,
  creator: string,
  amount: number, // in micro-RYL
  contentId: string
): Promise<Uint8Array[]> {
  const suggestedParams = await getSuggestedParams();
  const tax = Math.floor(amount * 0.05);
  const creatorCut = amount - tax;

  const creatorTx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: buyer,
    to: creator,
    assetIndex: ROYALE_ASSET_ID,
    amount: creatorCut,
    suggestedParams,
    note: new TextEncoder().encode(`royale_purchase_${contentId}`),
  });

  const taxTx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: buyer,
    to: ROYALE_TAX_ADDRESS,
    assetIndex: ROYALE_ASSET_ID,
    amount: tax,
    suggestedParams,
  });

  algosdk.assignGroupID([creatorTx, taxTx]);
  return [creatorTx.toByte(), taxTx.toByte()];
}

/**
 * Verify a completed transaction
 */
export async function verifyTransaction(txId: string): Promise<{
  confirmed: boolean;
  round?: number;
  amount?: number;
}> {
  try {
    const tx = await algodClient.pendingTransactionInformation(txId).do();

    if (tx['confirmed-round']) {
      return {
        confirmed: true,
        round: tx['confirmed-round'],
        amount: tx.txn?.txn?.amt,
      };
    }

    return { confirmed: false };
  } catch {
    return { confirmed: false };
  }
}

/**
 * Get account balance (ALGO + $RYL ASA)
 */
export async function getAccountBalances(address: string): Promise<{
  algo: number;
  ryl: number;
  optedIntoRYL: boolean;
}> {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    const algoBalance = accountInfo.amount / 1_000_000;

    let rylBalance = 0;
    let optedIntoRYL = false;

    if (ROYALE_ASSET_ID) {
      const asset = accountInfo.assets?.find(
        (a: any) => a['asset-id'] === ROYALE_ASSET_ID
      );
      if (asset) {
        rylBalance = asset.amount / 1_000_000;
        optedIntoRYL = true;
      }
    }

    return { algo: algoBalance, ryl: rylBalance, optedIntoRYL };
  } catch {
    return { algo: 0, ryl: 0, optedIntoRYL: false };
  }
}

/**
 * Opt-in to receive $RYL (required before first $RYL transfer on Algorand)
 */
export async function buildOptInTx(address: string): Promise<Uint8Array> {
  const suggestedParams = await getSuggestedParams();
  const tx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: address,
    to: address,  // self-transfer = opt-in
    assetIndex: ROYALE_ASSET_ID,
    amount: 0,
    suggestedParams,
    note: new TextEncoder().encode('royale_ryl_optin'),
  });
  return tx.toByte();
}

/**
 * Look up content purchase history for an address
 */
export async function getCreatorRevenue(creatorAddress: string): Promise<number> {
  try {
    const txns = await indexerClient
      .searchForTransactions()
      .address(creatorAddress)
      .addressRole('receiver')
      .notePrefix(Buffer.from('royale'))
      .do();

    const total = txns.transactions.reduce((sum: number, tx: any) => {
      return sum + (tx['payment-transaction']?.amount || 0);
    }, 0);

    return total / 1_000_000; // return in ALGO
  } catch {
    return 0;
  }
}

/**
 * Format microALGO to ALGO string
 */
export function microToAlgo(microAlgo: number): string {
  return (microAlgo / 1_000_000).toFixed(6);
}

export function algoToMicro(algo: number): number {
  return Math.floor(algo * 1_000_000);
}
