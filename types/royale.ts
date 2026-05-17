// ─── ROYALE GLOBAL TYPES ─────────────────────────────────────────────────────

export type Tier = 'citizen' | 'ambassador' | 'royalty';
export type Currency = 'ALGO' | 'RYL' | 'ETH' | 'MATIC';
export type ContentType = 'audio' | 'video' | 'image' | 'document' | 'other';
export type PipelineStep = 'command' | 'creation' | 'drop' | 'ipfs' | 'ether';

// ─── CONTENT ─────────────────────────────────────────────────────────────────

export interface RoyaleContent {
  id: string;
  title: string;
  description: string;
  contentType: ContentType;
  creator: string;            // wallet address
  creatorName?: string;
  ipfsCid: string;
  manifestCid?: string;
  gatewayUrl: string;
  priceMicro: number;         // microALGO or microRYL
  currency: Currency;
  plays: number;
  downloads: number;
  tags: string[];
  quantum?: {
    algorithm: string;
    nistLevel: number;
    signatureHex: string;
    contentHash: string;
  };
  ai?: {
    generated: boolean;
    model?: string;
    script?: ContentScript;
  };
  createdAt: number;          // Unix ms
  updatedAt?: number;
}

export interface ContentScript {
  title: string;
  script: string;
  description: string;
  tags: string[];
  tone: string;
  language: string;
  estimatedDuration: string;
  callToAction: string;
}

export interface ContentMetadata {
  title: string;
  description: string;
  contentType: ContentType;
  tags: string[];
  suggestedPrice: number;
  currency: Currency;
}

// ─── USER / CREATOR ──────────────────────────────────────────────────────────

export interface CreatorProfile {
  slug: string;
  name: string;
  bio?: string;
  walletAddress: string;
  avatar?: string;
  tier: Tier;
  nations: number;
  totalContent: number;
  totalRevenue: number;
  joinedAt: number;
  tags: string[];
  socials?: {
    twitter?: string;
    instagram?: string;
    website?: string;
  };
  gunPublicKey?: string;      // Gun SEA public key
}

// ─── WALLET ──────────────────────────────────────────────────────────────────

export interface WalletState {
  connected: boolean;
  address: string;
  chain: 'algorand' | 'ethereum' | null;
  balances: {
    algo?: number;
    ryl?: number;
    eth?: number;
  };
}

// ─── UPLOAD ──────────────────────────────────────────────────────────────────

export interface UploadResult {
  success: boolean;
  content: RoyaleContent;
  ipfs: {
    cid: string;
    gatewayUrl: string;
    manifestCid: string;
  };
  quantum: {
    algorithm: string;
    nistLevel: number;
    signatureHex: string;
    contentHash: string;
  };
  ai?: {
    metadata: ContentMetadata;
    script?: ContentScript;
  };
  processingMs: number;
}

// ─── QUANTUM ─────────────────────────────────────────────────────────────────

export interface QuantumManifest {
  version: string;
  contentHash: string;
  creatorAddress: string;
  signatureHex: string;
  publicKeyHex: string;
  algorithm: string;
  nistLevel: number;
  timestamp: number;
  metadata: Record<string, unknown>;
}

// ─── ALGORAND ────────────────────────────────────────────────────────────────

export interface AlgorandTxGroup {
  txns: Uint8Array[];
  groupId: string;
}

export interface ContentPurchaseParams {
  buyerAddress: string;
  creatorAddress: string;
  treasuryAddress: string;
  amountMicro: number;
  assetId?: number;           // undefined = ALGO, set = $RYL ASA
  contentId: string;
}

// ─── API RESPONSES ───────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data?: T;
  [key: string]: unknown;
}

export interface ApiError {
  success?: false;
  error: string;
  details?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── UI STATE ────────────────────────────────────────────────────────────────

export interface ConsoleMessage {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'quantum' | 'ipfs' | 'algo';
  text: string;
  timestamp: Date;
}

export interface UploadProgress {
  stage: PipelineStep;
  percent: number;
  message: string;
}
