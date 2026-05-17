/**
 * ROYALE - API ROUTE: /api/royale/upload
 *
 * Receives one file, enforces the voice pledge gate, unpacks ZIP archives when
 * needed, quantum-signs each upload, pins it to IPFS, and indexes it in Gun.js.
 */

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { sha3_256 } from '@noble/hashes/sha3';
import { v4 as uuidv4 } from 'uuid';

import { pinFileToIPFS, pinManifestToIPFS, RoyaleMetadata } from '@/lib/ipfs';
import { db, RoyaleContent } from '@/lib/gun';
import { generateMetadata } from '@/lib/ollama';
import { DilithiumDSA, KyberKEM } from '@/lib/quantum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Wallet-Address, X-Wallet-Sig, X-Quantum-Pub',
};

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const PLEDGE_PHRASES = ['yeshua is king', 'jesus is king'];
const SOVEREIGN_CONFIRMATION = 'stepintoroyale - Glory be to God';

interface UploadContext {
  command: string;
  walletAddress: string;
  creatorAlias: string;
  priceMicro: number;
  currency: RoyaleContent['currency'];
}

interface UploadCandidate {
  fileBuffer: Buffer;
  fileName: string;
  fileType: string;
  fileSize: number;
  zipSource?: string;
  zipPath?: string;
}

interface ProcessedUpload {
  content: RoyaleContent;
  ipfs: {
    cid: string;
    gatewayUrl: string;
    size: number;
    manifestCid: string;
    manifestUrl: string;
  };
  quantum: {
    algorithm: string;
    nistLevel: number;
    signatureHex: string;
    contentHash: string;
  };
  ai: {
    model?: string;
    generated: boolean;
    reason?: string;
  };
  file: {
    name: string;
    type: string;
    size: number;
    zipSource?: string;
    zipPath?: string;
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const command = String(formData.get('command') || '');
    const pledgeTranscript = String(formData.get('pledgeTranscript') || '');
    const walletAddress = String(formData.get('walletAddress') || 'anonymous');
    const creatorAlias = String(formData.get('creatorAlias') || 'Sovereign Creator');
    const priceMicro = parseInt(String(formData.get('priceMicro') || '0'), 10);
    const currency = String(formData.get('currency') || 'FREE') as RoyaleContent['currency'];
    const zipSource = String(formData.get('zipSource') || '') || undefined;
    const zipPath = String(formData.get('zipPath') || '') || undefined;

    if (!hasValidPledge(pledgeTranscript)) {
      return NextResponse.json(
        {
          error: 'Spiritual gate closed',
          message: 'Speak "Yeshua is King" or "Jesus is King" before uploading content.',
        },
        { status: 403, headers: CORS }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: CORS }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'File too large (max 500MB)' },
        { status: 413, headers: CORS }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || 'royale-upload.bin';
    const fileType = file.type || inferMimeType(fileName);
    const candidates = await buildUploadCandidates(
      fileBuffer,
      fileName,
      fileType,
      zipSource,
      zipPath
    );
    const context: UploadContext = {
      command,
      walletAddress,
      creatorAlias,
      priceMicro,
      currency,
    };

    const uploads: ProcessedUpload[] = [];

    for (const candidate of candidates) {
      uploads.push(await processUploadCandidate(candidate, context));
    }

    const elapsed = Date.now() - startTime;
    const first = uploads[0];
    const wasZipArchive = isZipFile(fileName, fileType);

    console.log(`[ROYALE] Upload complete: ${uploads.length} file(s) in ${elapsed}ms`);

    return NextResponse.json(
      {
        success: true,
        content: first.content,
        ipfs: first.ipfs,
        quantum: first.quantum,
        ai: first.ai,
        file: first.file,
        gate: { accepted: true },
        sovereignConfirmation: SOVEREIGN_CONFIRMATION,
        zip: wasZipArchive
          ? { source: fileName, entries: uploads.length }
          : undefined,
        files: wasZipArchive ? uploads : undefined,
        processingMs: elapsed,
      },
      { status: 201, headers: CORS }
    );
  } catch (err: any) {
    console.error('[ROYALE] Upload error:', err);
    return NextResponse.json(
      {
        error: 'Upload failed',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500, headers: CORS }
    );
  }
}

async function processUploadCandidate(
  candidate: UploadCandidate,
  context: UploadContext
): Promise<ProcessedUpload> {
  const {
    command,
    walletAddress,
    creatorAlias,
    priceMicro,
    currency,
  } = context;
  const {
    fileBuffer,
    fileName,
    fileType,
    fileSize,
    zipSource,
    zipPath,
  } = candidate;

  console.log(`[ROYALE] Upload: ${fileName} (${(fileSize / 1024).toFixed(1)} KB) by ${walletAddress}`);
  console.log('[ROYALE] Generating AI metadata...');

  const aiMeta = await generateMetadata(fileName, fileType, command).catch(err => {
    console.warn('[ROYALE] Ollama offline, using defaults:', err.message);
    return null;
  });

  console.log('[ROYALE] Applying quantum signature...');
  const signingKeyPair = DilithiumDSA.generateKeyPair();
  const contentHash = KyberKEM.toHex(sha3_256(fileBuffer));
  const messageToSign = new TextEncoder().encode(
    JSON.stringify({
      fileName,
      fileSize,
      contentHash,
      creator: walletAddress,
      zipSource,
      zipPath,
      timestamp: Date.now(),
      voicePledgeAccepted: true,
    })
  );
  const { signature } = DilithiumDSA.sign(messageToSign, signingKeyPair.secretKey);
  const quantumSig = KyberKEM.toHex(signature);
  const tags = uniqueTags([
    ...(aiMeta?.tags || []),
    ...(zipSource ? ['zip'] : []),
  ]);

  const royaleMetadata: RoyaleMetadata = {
    name: aiMeta?.title || fileName,
    creator: walletAddress,
    description: aiMeta?.description || 'Sovereign content uploaded to the Ark',
    contentType: fileType,
    language: aiMeta?.languages?.[0] || 'English',
    region: aiMeta?.regions?.[0] || 'Global',
    aiGenerated: false,
    ollamaModel: aiMeta ? (process.env.OLLAMA_MODEL || 'llama3.2') : undefined,
    quantumSig,
    nistLevel: 5,
    royaleVersion: '1.0.0',
    tags,
    unlockPrice: priceMicro > 0
      ? { amount: priceMicro / 1_000_000, currency }
      : undefined,
  };

  console.log('[ROYALE] Pinning to IPFS...');
  const pinResult = await pinFileToIPFS(fileBuffer, fileName, royaleMetadata);

  const manifestData = {
    ...royaleMetadata,
    ipfsCid: pinResult.cid,
    ipfsGatewayUrl: pinResult.gatewayUrl,
    contentHash,
    quantumPubKey: KyberKEM.toHex(signingKeyPair.publicKey),
    voicePledge: 'accepted',
    zipSource,
    zipPath,
    uploadedAt: new Date().toISOString(),
  };
  const manifestPin = await pinManifestToIPFS(manifestData, fileName);

  console.log('[ROYALE] Indexing in Gun.js...');
  const contentId = uuidv4();
  const royaleContent: RoyaleContent = {
    id: contentId,
    title: aiMeta?.title || fileName,
    description: royaleMetadata.description,
    contentType: toRoyaleContentType(fileType),
    ipfsCid: pinResult.cid,
    ipfsGatewayUrl: pinResult.gatewayUrl,
    creator: walletAddress,
    creatorAlias,
    priceMicro,
    currency,
    tags,
    language: royaleMetadata.language,
    region: royaleMetadata.region,
    aiGenerated: false,
    quantumSig,
    quantumPubKey: KyberKEM.toHex(signingKeyPair.publicKey),
    nistLevel: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    playCount: 0,
    downloadCount: 0,
    royaleNode: `royale/v1/content/${contentId}`,
  };

  await db.putContent(royaleContent);
  await db.trackEvent({
    type: 'upload',
    contentId,
    walletAddress,
    region: royaleMetadata.region,
  });

  return {
    content: royaleContent,
    ipfs: {
      cid: pinResult.cid,
      gatewayUrl: pinResult.gatewayUrl,
      size: pinResult.size,
      manifestCid: manifestPin.cid,
      manifestUrl: manifestPin.gatewayUrl,
    },
    quantum: {
      algorithm: 'ML-DSA-65 (CRYSTALS-Dilithium-3)',
      nistLevel: 5,
      signatureHex: quantumSig.slice(0, 64) + '...',
      contentHash,
    },
    ai: aiMeta
      ? { model: process.env.OLLAMA_MODEL, generated: true }
      : { generated: false, reason: 'Ollama offline' },
    file: {
      name: fileName,
      type: fileType,
      size: fileSize,
      zipSource,
      zipPath,
    },
  };
}

async function buildUploadCandidates(
  fileBuffer: Buffer,
  fileName: string,
  fileType: string,
  zipSource?: string,
  zipPath?: string
): Promise<UploadCandidate[]> {
  if (!isZipFile(fileName, fileType)) {
    return [
      {
        fileBuffer,
        fileName,
        fileType,
        fileSize: fileBuffer.byteLength,
        zipSource,
        zipPath,
      },
    ];
  }

  const archive = await JSZip.loadAsync(fileBuffer);
  const entries = Object.values(archive.files).filter(entry =>
    !entry.dir && !isSystemZipEntry(entry.name)
  );

  if (entries.length === 0) {
    throw new Error('ZIP archive contains no uploadable files');
  }

  const candidates: UploadCandidate[] = [];
  let unpackedBytes = 0;

  for (const entry of entries) {
    const buffer = await entry.async('nodebuffer');
    unpackedBytes += buffer.byteLength;

    if (unpackedBytes > MAX_UPLOAD_BYTES) {
      throw new Error('Unpacked ZIP is too large (max 500MB)');
    }

    candidates.push({
      fileBuffer: buffer,
      fileName: flattenZipEntryName(entry.name),
      fileType: inferMimeType(entry.name),
      fileSize: buffer.byteLength,
      zipSource: fileName,
      zipPath: entry.name,
    });
  }

  return candidates;
}

function hasValidPledge(transcript: string) {
  const normalized = transcript
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return PLEDGE_PHRASES.some(phrase => normalized.includes(phrase));
}

function isZipFile(fileName: string, fileType: string) {
  return (
    fileName.toLowerCase().endsWith('.zip') ||
    fileType === 'application/zip' ||
    fileType === 'application/x-zip-compressed'
  );
}

function isSystemZipEntry(entryName: string) {
  const normalized = entryName.replace(/\\/g, '/');

  return (
    normalized.startsWith('__MACOSX/') ||
    normalized.endsWith('/.DS_Store') ||
    normalized.endsWith('Thumbs.db')
  );
}

function flattenZipEntryName(entryName: string) {
  const safePath = entryName
    .replace(/\\/g, '/')
    .split('/')
    .filter(segment => segment && segment !== '.' && segment !== '..')
    .join('__')
    .replace(/[<>:"|?*\x00-\x1F]/g, '_');

  return safePath || `zip-entry-${Date.now()}`;
}

function inferMimeType(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    html: 'text/html',
    csv: 'text/csv',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

function toRoyaleContentType(fileType: string): RoyaleContent['contentType'] {
  if (fileType.startsWith('audio')) return 'music';
  if (fileType.startsWith('video')) return 'video';
  if (fileType.startsWith('image')) return 'image';
  if (fileType === 'application/zip' || fileType === 'application/x-zip-compressed') return 'mixed';
  return 'text';
}

function uniqueTags(tags: string[]) {
  return Array.from(new Set(tags.filter(Boolean).map(tag => tag.trim())));
}
