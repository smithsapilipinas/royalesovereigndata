/**
 * ROYALE — IPFS / PINATA INTEGRATION
 *
 * Every file uploaded to Royale is:
 *   1. Quantum-signed (Dilithium-3) BEFORE upload
 *   2. Pinned to IPFS via Pinata
 *   3. Indexed in Gun.js decentralized DB
 *   4. Smart contract metadata registered on Algorand
 *
 * IPFS CIDs are permanent, content-addressed, censorship-resistant.
 * Once in the Ark — it cannot be removed.
 */

import PinataSDK from '@pinata/sdk';
import { Readable } from 'stream';

const pinata = new PinataSDK({
  pinataApiKey: process.env.PINATA_API_KEY!,
  pinataSecretApiKey: process.env.PINATA_SECRET_API_KEY!,
});

const GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export interface PinResult {
  cid: string;
  gatewayUrl: string;
  size: number;
  timestamp: number;
}

export interface RoyaleMetadata {
  name: string;
  creator: string;
  description: string;
  contentType: string;
  language: string;
  region: string;
  aiGenerated: boolean;
  ollamaModel?: string;
  quantumSig: string;
  nistLevel: number;
  royaleVersion: string;
  tags: string[];
  unlockPrice?: { amount: number; currency: string };
}

// ─── FILE UPLOAD ─────────────────────────────────────────────────────────────

/**
 * Pin a file Buffer to IPFS via Pinata
 * Returns the permanent CID
 */
export async function pinFileToIPFS(
  fileBuffer: Buffer,
  fileName: string,
  metadata: RoyaleMetadata
): Promise<PinResult> {
  // Convert Buffer to readable stream
  const stream = new Readable();
  stream.push(fileBuffer);
  stream.push(null);

  const pinataMetadata = {
    name: `royale_${fileName}`,
    keyvalues: {
      creator: metadata.creator,
      contentType: metadata.contentType,
      region: metadata.region,
      language: metadata.language,
      quantumSig: metadata.quantumSig.slice(0, 64), // Pinata truncates long values
      nistLevel: String(metadata.nistLevel),
      royaleVersion: metadata.royaleVersion,
      aiGenerated: String(metadata.aiGenerated),
    },
  };

  const pinataOptions = {
    cidVersion: 1 as const,
    wrapWithDirectory: false,
  };

  const result = await pinata.pinFileToIPFS(stream, {
    pinataMetadata,
    pinataOptions,
  });

  return {
    cid: result.IpfsHash,
    gatewayUrl: `${GATEWAY}/${result.IpfsHash}`,
    size: result.PinSize,
    timestamp: Date.now(),
  };
}

/**
 * Pin JSON metadata to IPFS (the content manifest)
 * This creates the "token URI" equivalent for each piece of content
 */
export async function pinManifestToIPFS(
  manifest: RoyaleMetadata & Record<string, unknown>,
  name: string
): Promise<PinResult> {
  const result = await pinata.pinJSONToIPFS(manifest, {
    pinataMetadata: { name: `royale_manifest_${name}` },
    pinataOptions: { cidVersion: 1 },
  });

  return {
    cid: result.IpfsHash,
    gatewayUrl: `${GATEWAY}/${result.IpfsHash}`,
    size: result.PinSize,
    timestamp: Date.now(),
  };
}

/**
 * Fetch file from IPFS gateway
 */
export async function fetchFromIPFS(cid: string): Promise<Response> {
  const url = `${GATEWAY}/${cid}`;
  return fetch(url);
}

/**
 * Unpin content (creator-initiated removal from Pinata)
 * Note: CID still exists on the global IPFS network
 */
export async function unpinFromPinata(cid: string): Promise<boolean> {
  try {
    await pinata.unpin(cid);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all pinned content for the current Pinata account
 */
export async function listPinnedContent(
  filters?: { creator?: string; contentType?: string }
) {
  const query: any = { status: 'pinned' };

  if (filters?.creator) {
    query.metadata = { keyvalues: { creator: { value: filters.creator, op: 'eq' } } };
  }

  const result = await pinata.pinList(query);
  return result.rows.map(row => ({
    cid: row.ipfs_pin_hash,
    name: row.metadata.name,
    size: row.size,
    timestamp: new Date(row.date_pinned).getTime(),
    metadata: row.metadata.keyvalues,
  }));
}

/**
 * Test Pinata authentication
 */
export async function testPinataConnection(): Promise<boolean> {
  try {
    const result = await pinata.testAuthentication();
    return result.authenticated;
  } catch {
    return false;
  }
}
