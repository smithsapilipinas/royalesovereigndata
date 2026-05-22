/**
 * ROYALE - API ROUTE: /api/royale/upload
 *
 * SOVEREIGN COMPUTE PIPELINE:
 *   1. Voice pledge gate (Yeshua is King)
 *   2. Unpack ZIP if needed
 *   3. ◈ SOVEREIGN COMPUTE → sharp optimizes images, extracts metadata
 *   4. Quantum sign the PROCESSED buffer (Dilithium-3)
 *   5. Pin optimized file + thumbnail to IPFS
 *   6. Index in Gun.js
 *
 * The server does the heavy lifting. What reaches IPFS is already
 * optimized, stripped of privacy metadata, and sovereign-signed.
 */

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { sha3_256 } from '@noble/hashes/sha3';
import { v4 as uuidv4 } from 'uuid';

import { pinFileToIPFS, pinManifestToIPFS, RoyaleMetadata } from '@/lib/ipfs';
import { db, RoyaleContent } from '@/lib/gun';
import { computeMetadata } from '@/lib/compute';
import { DilithiumDSA, KyberKEM } from '@/lib/quantum';
import { sovereignProcess, formatBytes, type ProcessorResult } from '@/lib/processor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Wallet-Address, X-Wallet-Sig, X-Quantum-Pub',
};

const MAX_UPLOAD_BYTES  = 500 * 1024 * 1024;
const PLEDGE_PHRASES    = ['yeshua is king', 'jesus is king'];
const SOVEREIGN_CONFIRMATION = 'stepintoroyale - Glory be to God';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface UploadContext {
  command:       string;
  walletAddress: string;
  creatorAlias:  string;
  priceMicro:    number;
  currency:      RoyaleContent['currency'];
}

interface UploadCandidate {
  fileBuffer: Buffer;
  fileName:   string;
  fileType:   string;
  fileSize:   number;
  zipSource?: string;
  zipPath?:   string;
}

interface ProcessedUpload {
  content: RoyaleContent;
  ipfs: {
    cid:          string;
    gatewayUrl:   string;
    size:         number;
    manifestCid:  string;
    manifestUrl:  string;
    thumbnailCid?: string;
    thumbnailUrl?: string;
  };
  quantum: {
    algorithm:    string;
    nistLevel:    number;
    signatureHex: string;
    contentHash:  string;
  };
  ai:   { model?: string; generated: boolean; reason?: string };
  file: { name: string; type: string; size: number; zipSource?: string; zipPath?: string };
  compute: ProcessorResult['compute'] & { meta: ProcessorResult['meta'] };
}

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const formData        = await req.formData();
    const file            = formData.get('file') as File | null;
    const command         = String(formData.get('command')         || '');
    const pledgeTranscript= String(formData.get('pledgeTranscript')|| '');
    const walletAddress   = String(formData.get('walletAddress')   || 'anonymous');
    const creatorAlias    = String(formData.get('creatorAlias')    || 'Sovereign Creator');
    const priceMicro      = parseInt(String(formData.get('priceMicro') || '0'), 10);
    const currency        = String(formData.get('currency') || 'FREE') as RoyaleContent['currency'];
    const zipSource       = String(formData.get('zipSource') || '') || undefined;
    const zipPath         = String(formData.get('zipPath')   || '') || undefined;

    if (!hasValidPledge(pledgeTranscript)) {
      return NextResponse.json(
        {
          error:   'Spiritual gate closed',
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
    const fileName   = file.name    || 'royale-upload.bin';
    const fileType   = file.type    || inferMimeType(fileName);
    const candidates = await buildUploadCandidates(fileBuffer, fileName, fileType, zipSource, zipPath);
    const context: UploadContext = { command, walletAddress, creatorAlias, priceMicro, currency };

    const uploads: ProcessedUpload[] = [];
    for (const candidate of candidates) {
      uploads.push(await processUploadCandidate(candidate, context));
    }

    const elapsed        = Date.now() - startTime;
    const first          = uploads[0];
    const wasZipArchive  = isZipFile(fileName, fileType);

    console.log(`[ROYALE] Upload complete: ${uploads.length} file(s) in ${elapsed}ms`);

    return NextResponse.json(
      {
        success:               true,
        content:               first.content,
        ipfs:                  first.ipfs,
        quantum:               first.quantum,
        ai:                    first.ai,
        file:                  first.file,
        compute:               first.compute,
        gate:                  { accepted: true },
        sovereignConfirmation: SOVEREIGN_CONFIRMATION,
        zip: wasZipArchive ? { source: fileName, entries: uploads.length } : undefined,
        files:                 wasZipArchive ? uploads : undefined,
        processingMs:          elapsed,
      },
      { status: 201, headers: CORS }
    );
  } catch (err: unknown) {
    const e = err as Error;
    console.error('[ROYALE] Upload error:', e);
    return NextResponse.json(
      {
        error:   'Upload failed',
        message: e.message,
        stack:   process.env.NODE_ENV === 'development' ? e.stack : undefined,
      },
      { status: 500, headers: CORS }
    );
  }
}

// ─── CORE PIPELINE ────────────────────────────────────────────────────────────

async function processUploadCandidate(
  candidate: UploadCandidate,
  context: UploadContext
): Promise<ProcessedUpload> {
  const { command, walletAddress, creatorAlias, priceMicro, currency } = context;
  const { fileBuffer, fileName, fileType, fileSize, zipSource, zipPath } = candidate;

  console.log(`[ROYALE] Upload: ${fileName} (${formatBytes(fileSize)}) by ${walletAddress}`);

  // ── STEP 1: SOVEREIGN COMPUTE ─────────────────────────────────────────────
  // The server processes the file before it ever touches IPFS.
  console.log('[COMPUTE] Running sovereign processor...');
  const processed = await sovereignProcess(fileBuffer, fileName, fileType);

  if (processed.compute.provider === 'sharp') {
    const saved = processed.compute.savingsPercent;
    console.log(
      `[COMPUTE] Image optimized: ${formatBytes(processed.compute.originalSize)} → ` +
      `${formatBytes(processed.compute.processedSize)} (${saved}% smaller) | ` +
      `ops: ${processed.compute.operations.join(', ')}`
    );
  } else {
    console.log(`[COMPUTE] ${processed.compute.operations.join(', ')} (${processed.mimeType})`);
  }

  // ── STEP 2: AI METADATA (on processed file) ───────────────────────────────
  console.log('[COMPUTE] Generating AI metadata...');
  const aiMeta = await computeMetadata(processed.fileName, processed.mimeType, command).catch(err => {
    console.warn('[COMPUTE] All providers unavailable, using defaults:', err.message);
    return null;
  });

  // ── STEP 3: QUANTUM SIGN PROCESSED BUFFER ────────────────────────────────
  // We sign what gets stored — the optimized, processed version.
  console.log('[QUANTUM] Signing processed buffer...');
  const signingKeyPair = DilithiumDSA.generateKeyPair();
  const contentHash    = KyberKEM.toHex(sha3_256(processed.buffer));
  const messageToSign  = new TextEncoder().encode(
    JSON.stringify({
      fileName:         processed.fileName,
      processedSize:    processed.compute.processedSize,
      originalSize:     processed.compute.originalSize,
      contentHash,
      creator:          walletAddress,
      computeOps:       processed.compute.operations,
      zipSource,
      zipPath,
      timestamp:        Date.now(),
      voicePledgeAccepted: true,
    })
  );
  const { signature } = DilithiumDSA.sign(messageToSign, signingKeyPair.secretKey);
  const quantumSig    = KyberKEM.toHex(signature);

  const tags = uniqueTags([
    ...(aiMeta?.tags   || []),
    ...(zipSource      ? ['zip'] : []),
    ...(processed.compute.provider === 'sharp' ? ['optimized', 'webp'] : []),
    ...(processed.meta.duration != null ? ['has-duration'] : []),
  ]);

  // ── STEP 4: BUILD IPFS METADATA ──────────────────────────────────────────
  const royaleMetadata: RoyaleMetadata = {
    name:        aiMeta?.title || processed.fileName,
    creator:     walletAddress,
    description: aiMeta?.description || 'Sovereign content uploaded to the Ark',
    contentType: processed.mimeType,
    language:    (aiMeta?.languages as string[] | undefined)?.[0] || 'English',
    region:      (aiMeta?.regions   as string[] | undefined)?.[0] || 'Global',
    aiGenerated: false,
    ollamaModel: aiMeta ? (process.env.OLLAMA_MODEL || 'llama3.2') : undefined,
    quantumSig,
    nistLevel:   5,
    royaleVersion: '2.0.0',
    tags,
    unlockPrice: priceMicro > 0
      ? { amount: priceMicro / 1_000_000, currency }
      : undefined,
  };

  // ── STEP 5: PIN PROCESSED FILE TO IPFS ───────────────────────────────────
  console.log('[IPFS] Pinning processed file...');
  const pinResult = await pinFileToIPFS(processed.buffer, processed.fileName, royaleMetadata);

  // ── STEP 6: PIN THUMBNAIL (images only) ──────────────────────────────────
  let thumbnailCid: string | undefined;
  let thumbnailUrl: string | undefined;
  if (processed.thumbnail && processed.thumbnailMimeType) {
    console.log('[IPFS] Pinning thumbnail...');
    try {
      const thumbMeta: RoyaleMetadata = {
        ...royaleMetadata,
        name: `${royaleMetadata.name} (thumbnail)`,
        contentType: processed.thumbnailMimeType,
      };
      const thumbPin = await pinFileToIPFS(
        processed.thumbnail,
        processed.fileName.replace('.webp', '-thumb.webp'),
        thumbMeta
      );
      thumbnailCid = thumbPin.cid;
      thumbnailUrl = thumbPin.gatewayUrl;
      console.log(`[IPFS] Thumbnail pinned: ${thumbnailCid}`);
    } catch (e) {
      console.warn('[IPFS] Thumbnail pin failed:', (e as Error).message);
    }
  }

  // ── STEP 7: PIN MANIFEST ─────────────────────────────────────────────────
  const manifestData = {
    ...royaleMetadata,
    ipfsCid:         pinResult.cid,
    ipfsGatewayUrl:  pinResult.gatewayUrl,
    thumbnailCid,
    thumbnailUrl,
    contentHash,
    quantumPubKey:   KyberKEM.toHex(signingKeyPair.publicKey),
    voicePledge:     'accepted',
    sovereignCompute: {
      provider:        processed.compute.provider,
      operations:      processed.compute.operations,
      originalSize:    processed.compute.originalSize,
      processedSize:   processed.compute.processedSize,
      savingsPercent:  processed.compute.savingsPercent,
    },
    imageMeta: processed.compute.provider === 'sharp' ? {
      width:         processed.meta.width,
      height:        processed.meta.height,
      dominantColor: processed.meta.dominantColor,
    } : undefined,
    mediaMeta: processed.meta.duration != null ? {
      duration:   processed.meta.duration,
      bitrate:    processed.meta.bitrate,
      sampleRate: processed.meta.sampleRate,
    } : undefined,
    zipSource,
    zipPath,
    uploadedAt: new Date().toISOString(),
  };

  const manifestPin = await pinManifestToIPFS(manifestData, processed.fileName);

  // ── STEP 8: INDEX IN GUN.JS ───────────────────────────────────────────────
  console.log('[GUN] Indexing in P2P database...');
  const contentId     = uuidv4();
  const royaleContent: RoyaleContent = {
    id:            contentId,
    title:         aiMeta?.title || processed.fileName,
    description:   royaleMetadata.description,
    contentType:   toRoyaleContentType(processed.mimeType),
    ipfsCid:       pinResult.cid,
    ipfsGatewayUrl: pinResult.gatewayUrl,
    creator:       walletAddress,
    creatorAlias,
    priceMicro,
    currency,
    tags,
    language:      royaleMetadata.language,
    region:        royaleMetadata.region,
    aiGenerated:   false,
    quantumSig,
    quantumPubKey: KyberKEM.toHex(signingKeyPair.publicKey),
    nistLevel:     5,
    createdAt:     Date.now(),
    updatedAt:     Date.now(),
    playCount:     0,
    downloadCount: 0,
    royaleNode:    `royale/v2/content/${contentId}`,
  };

  await db.putContent(royaleContent);
  await db.trackEvent({ type: 'upload', contentId, walletAddress, region: royaleMetadata.region });

  return {
    content: royaleContent,
    ipfs: {
      cid:          pinResult.cid,
      gatewayUrl:   pinResult.gatewayUrl,
      size:         pinResult.size,
      manifestCid:  manifestPin.cid,
      manifestUrl:  manifestPin.gatewayUrl,
      thumbnailCid,
      thumbnailUrl,
    },
    quantum: {
      algorithm:    'ML-DSA-65 (CRYSTALS-Dilithium-3)',
      nistLevel:    5,
      signatureHex: quantumSig.slice(0, 64) + '...',
      contentHash,
    },
    ai: aiMeta
      ? { model: process.env.OLLAMA_MODEL, generated: true }
      : { generated: false, reason: 'AI unavailable' },
    file: {
      name:      fileName,
      type:      fileType,
      size:      fileSize,
      zipSource,
      zipPath,
    },
    compute: {
      ...processed.compute,
      meta: processed.meta,
    },
  };
}

// ─── ZIP UNPACKER ─────────────────────────────────────────────────────────────

async function buildUploadCandidates(
  fileBuffer: Buffer,
  fileName:   string,
  fileType:   string,
  zipSource?: string,
  zipPath?:   string
): Promise<UploadCandidate[]> {
  if (!isZipFile(fileName, fileType)) {
    return [{ fileBuffer, fileName, fileType, fileSize: fileBuffer.byteLength, zipSource, zipPath }];
  }

  const archive = await JSZip.loadAsync(fileBuffer);
  const entries = Object.values(archive.files).filter(
    e => !e.dir && !isSystemZipEntry(e.name)
  );

  if (!entries.length) throw new Error('ZIP archive contains no uploadable files');

  const candidates: UploadCandidate[] = [];
  let unpackedBytes = 0;

  for (const entry of entries) {
    const buf = await entry.async('nodebuffer');
    unpackedBytes += buf.byteLength;
    if (unpackedBytes > MAX_UPLOAD_BYTES) throw new Error('Unpacked ZIP is too large (max 500MB)');
    candidates.push({
      fileBuffer: buf,
      fileName:   flattenZipEntryName(entry.name),
      fileType:   inferMimeType(entry.name),
      fileSize:   buf.byteLength,
      zipSource:  fileName,
      zipPath:    entry.name,
    });
  }

  return candidates;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function hasValidPledge(transcript: string): boolean {
  const n = transcript.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return PLEDGE_PHRASES.some(p => n.includes(p));
}

function isZipFile(fileName: string, fileType: string): boolean {
  return (
    fileName.toLowerCase().endsWith('.zip') ||
    fileType === 'application/zip' ||
    fileType === 'application/x-zip-compressed'
  );
}

function isSystemZipEntry(name: string): boolean {
  const n = name.replace(/\\/g, '/');
  return n.startsWith('__MACOSX/') || n.endsWith('/.DS_Store') || n.endsWith('Thumbs.db');
}

function flattenZipEntryName(name: string): string {
  return (
    name
      .replace(/\\/g, '/')
      .split('/')
      .filter(s => s && s !== '.' && s !== '..')
      .join('__')
      .replace(/[<>:"|?*\x00-\x1F]/g, '_') || `zip-entry-${Date.now()}`
  );
}

function inferMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac', ogg: 'audio/ogg',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml',
    txt: 'text/plain', md: 'text/markdown', json: 'application/json',
    html: 'text/html', csv: 'text/csv',
  };
  return map[ext] || 'application/octet-stream';
}

function toRoyaleContentType(mimeType: string): RoyaleContent['contentType'] {
  const t = mimeType.split('/')[0];
  if (t === 'audio') return 'music';
  if (t === 'video') return 'video';
  if (t === 'image') return 'image';
  if (mimeType.includes('zip')) return 'mixed';
  return 'text';
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean).map(t => t.trim())));
}
