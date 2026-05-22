/**
 * ROYALE — SOVEREIGN COMPUTE PROCESSOR
 *
 * The server does the heavy lifting BEFORE content reaches IPFS.
 * Every file is optimized, enriched, and prepared on YOUR infrastructure.
 *
 * PIPELINE ORDER:
 *   Raw upload → sovereignProcess() → optimized buffer → quantum sign → IPFS pin
 *
 * The quantum signature covers the PROCESSED buffer — what gets stored is
 * the clean, optimized version, not the raw upload.
 *
 * HANDLING BY TYPE:
 *   Images    → sharp: resize (max 1920px), WebP q85, thumbnail, strip EXIF
 *   Audio     → ID3/WAV metadata extraction, pass-through
 *   Video     → MP4/MOV metadata extraction, pass-through
 *   Documents → text preview, pass-through
 *   Other     → hash + size, pass-through
 */

import sharp from 'sharp';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ProcessorResult {
  buffer:             Buffer;
  fileName:           string;
  mimeType:           string;
  thumbnail?:         Buffer;
  thumbnailMimeType?: string;
  compute: {
    originalSize:    number;
    processedSize:   number;
    savingsPercent:  number;
    operations:      string[];
    durationMs:      number;
    provider:        'sharp' | 'passthrough';
  };
  meta: {
    width?:         number;
    height?:        number;
    format?:        string;
    hasAlpha?:      boolean;
    dominantColor?: string;
    duration?:      number;
    bitrate?:       number;
    sampleRate?:    number;
    textPreview?:   string;
    pageCount?:     number;
  };
}

// ─── IMAGE PROCESSING (sharp) ─────────────────────────────────────────────────

const IMAGE_MAX_PX     = 1920;
const IMAGE_WEBP_Q     = 85;
const THUMB_WIDTH      = 480;
const THUMB_WEBP_Q     = 75;

async function processImage(
  buffer: Buffer,
  fileName: string
): Promise<ProcessorResult> {
  const start        = Date.now();
  const ops:string[] = [];
  const originalSize = buffer.length;

  const sourceMeta = await sharp(buffer).metadata();

  let pipeline = sharp(buffer)
    // Strip all EXIF / ICC / location data — privacy by default
    .withMetadata({ exif: {}, icc: false, iptc: false, xmp: false });
  ops.push('strip-exif');

  if (
    (sourceMeta.width  || 0) > IMAGE_MAX_PX ||
    (sourceMeta.height || 0) > IMAGE_MAX_PX
  ) {
    pipeline = pipeline.resize(IMAGE_MAX_PX, IMAGE_MAX_PX, {
      fit:               'inside',
      withoutEnlargement: true,
    });
    ops.push(`resize-${IMAGE_MAX_PX}px`);
  }

  pipeline = pipeline.webp({ quality: IMAGE_WEBP_Q });
  ops.push(`webp-q${IMAGE_WEBP_Q}`);

  const processedBuffer = await pipeline.toBuffer();
  const processedMeta   = await sharp(processedBuffer).metadata();

  // Thumbnail — always 480px wide WebP
  const thumbnailBuffer = await sharp(buffer)
    .resize(THUMB_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
    .withMetadata({ exif: {}, icc: false })
    .webp({ quality: THUMB_WEBP_Q })
    .toBuffer();
  ops.push(`thumb-${THUMB_WIDTH}px-webp`);

  // Dominant color — 1×1 downsample (fast, no deps)
  let dominantColor: string | undefined;
  try {
    const tiny = await sharp(buffer)
      .resize(1, 1, { fit: 'cover' })
      .raw()
      .toBuffer();
    dominantColor =
      '#' +
      [tiny[0], tiny[1], tiny[2]]
        .map(n => n.toString(16).padStart(2, '0'))
        .join('');
  } catch { /* non-critical */ }

  const processedSize  = processedBuffer.length;
  const savingsPercent = Math.max(
    0,
    Math.round(((originalSize - processedSize) / originalSize) * 100)
  );

  return {
    buffer:            processedBuffer,
    fileName:          fileName.replace(/\.[^.]+$/, '') + '.webp',
    mimeType:          'image/webp',
    thumbnail:         thumbnailBuffer,
    thumbnailMimeType: 'image/webp',
    compute: {
      originalSize,
      processedSize,
      savingsPercent,
      operations:  ops,
      durationMs:  Date.now() - start,
      provider:    'sharp',
    },
    meta: {
      width:         processedMeta.width,
      height:        processedMeta.height,
      format:        'webp',
      hasAlpha:      processedMeta.hasAlpha,
      dominantColor,
    },
  };
}

// ─── AUDIO METADATA (no transcoding — pass-through) ──────────────────────────

function parseAudioMeta(buffer: Buffer, mimeType: string): ProcessorResult['meta'] {
  // MP3: parse first valid frame header for bitrate / sample rate
  if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
    for (let i = 0; i < Math.min(buffer.length - 4, 10_000); i++) {
      if (buffer[i] === 0xff && (buffer[i + 1] & 0xe0) === 0xe0) {
        const h        = buffer.readUInt32BE(i);
        const bitrateIdx  = (h >>> 12) & 0xf;
        const sampleIdx   = (h >>> 10) & 0x3;
        const bitrateTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
        const sampleTable  = [44100, 48000, 32000, 0];
        const bitrate  = bitrateTable[bitrateIdx] * 1000;
        const sampleRate = sampleTable[sampleIdx];
        // Rough duration from file size + bitrate
        const duration = bitrate > 0 ? (buffer.length * 8) / bitrate : undefined;
        return { bitrate, sampleRate, duration: duration ? Math.round(duration) : undefined };
      }
    }
  }

  // WAV: RIFF header
  if (
    mimeType === 'audio/wav' ||
    mimeType === 'audio/wave' ||
    mimeType === 'audio/x-wav'
  ) {
    if (
      buffer.length >= 44 &&
      buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
      buffer.slice(8, 12).toString('ascii') === 'WAVE'
    ) {
      const sampleRate    = buffer.readUInt32LE(24);
      const bitsPerSample = buffer.readUInt16LE(34);
      const channels      = buffer.readUInt16LE(22);
      const byteRate      = buffer.readUInt32LE(28);
      const dataSize      = buffer.readUInt32LE(40);
      const duration      = byteRate > 0 ? Math.round(dataSize / byteRate) : undefined;
      return {
        sampleRate,
        bitrate:     byteRate * 8,
        duration,
      };
    }
  }

  return {};
}

async function processAudio(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessorResult> {
  const start = Date.now();
  return {
    buffer,
    fileName,
    mimeType,
    compute: {
      originalSize:   buffer.length,
      processedSize:  buffer.length,
      savingsPercent: 0,
      operations:     ['metadata-extract', 'passthrough'],
      durationMs:     Date.now() - start,
      provider:       'passthrough',
    },
    meta: parseAudioMeta(buffer, mimeType),
  };
}

// ─── VIDEO METADATA (no transcoding — pass-through) ──────────────────────────

function parseVideoMeta(buffer: Buffer, mimeType: string): ProcessorResult['meta'] {
  // MP4: look for mvhd box which contains duration + timescale
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    let offset = 0;
    while (offset + 8 < buffer.length) {
      const boxSize = buffer.readUInt32BE(offset);
      const boxType = buffer.slice(offset + 4, offset + 8).toString('ascii');
      if (boxType === 'mvhd' && offset + 24 < buffer.length) {
        const version    = buffer[offset + 8];
        const timescale  = version === 1
          ? buffer.readUInt32BE(offset + 20)
          : buffer.readUInt32BE(offset + 16);
        const durationRaw = version === 1
          ? Number(buffer.readBigUInt64BE(offset + 24))
          : buffer.readUInt32BE(offset + 20);
        const duration = timescale > 0 ? Math.round(durationRaw / timescale) : undefined;
        return { duration };
      }
      if (boxSize < 8 || offset + boxSize >= buffer.length) break;
      offset += boxSize;
    }
  }
  return {};
}

async function processVideo(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessorResult> {
  const start = Date.now();
  return {
    buffer,
    fileName,
    mimeType,
    compute: {
      originalSize:   buffer.length,
      processedSize:  buffer.length,
      savingsPercent: 0,
      operations:     ['metadata-extract', 'passthrough'],
      durationMs:     Date.now() - start,
      provider:       'passthrough',
    },
    meta: parseVideoMeta(buffer, mimeType),
  };
}

// ─── DOCUMENT PROCESSING (text preview — pass-through) ───────────────────────

function extractTextPreview(buffer: Buffer, mimeType: string): string | undefined {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return buffer.toString('utf8').slice(0, 500).replace(/\s+/g, ' ').trim();
  }
  if (mimeType === 'application/json') {
    try {
      const parsed = JSON.parse(buffer.toString('utf8'));
      return JSON.stringify(parsed).slice(0, 300);
    } catch { /* not valid JSON */ }
  }
  // PDF: look for text between BT/ET operators (rough extraction)
  if (mimeType === 'application/pdf') {
    const text    = buffer.toString('latin1');
    const matches = text.match(/\(([^)]{3,})\)/g);
    if (matches) {
      return matches
        .slice(0, 20)
        .map(m => m.slice(1, -1))
        .join(' ')
        .slice(0, 400)
        .trim();
    }
  }
  return undefined;
}

async function processDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessorResult> {
  const start       = Date.now();
  const textPreview = extractTextPreview(buffer, mimeType);
  return {
    buffer,
    fileName,
    mimeType,
    compute: {
      originalSize:   buffer.length,
      processedSize:  buffer.length,
      savingsPercent: 0,
      operations:     textPreview ? ['text-extract', 'passthrough'] : ['passthrough'],
      durationMs:     Date.now() - start,
      provider:       'passthrough',
    },
    meta: { textPreview },
  };
}

// ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────

export async function sovereignProcess(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessorResult> {
  const t = mimeType.split('/')[0];

  if (t === 'image') {
    return processImage(buffer, fileName);
  }
  if (t === 'audio') {
    return processAudio(buffer, fileName, mimeType);
  }
  if (t === 'video') {
    return processVideo(buffer, fileName, mimeType);
  }
  if (
    mimeType === 'application/pdf' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'application/json' ||
    mimeType === 'text/html'
  ) {
    return processDocument(buffer, fileName, mimeType);
  }

  // Everything else: pass-through with basic stats
  const start = Date.now();
  return {
    buffer,
    fileName,
    mimeType,
    compute: {
      originalSize:   buffer.length,
      processedSize:  buffer.length,
      savingsPercent: 0,
      operations:     ['passthrough'],
      durationMs:     Date.now() - start,
      provider:       'passthrough',
    },
    meta: {},
  };
}

// ─── UTILITY: human-readable size ────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
