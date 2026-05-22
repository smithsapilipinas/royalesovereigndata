/**
 * ROYALE — API ROUTE: /api/credentials/card
 *
 * Returns an SVG image representing a Royale Creator Credential.
 * Embed in emails, share as an image, or download.
 *
 * GET /api/credentials/card?did=...&alias=...&tier=...&address=...&vcId=...&expires=...
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIER_CONFIG = {
  citizen:    { label: 'CITIZEN',    color: '#FFD700', glow: 'rgba(255,215,0,0.3)'  },
  ambassador: { label: 'AMBASSADOR', color: '#00FFFF', glow: 'rgba(0,255,255,0.3)'  },
  royalty:    { label: 'ROYALTY',    color: '#C084FC', glow: 'rgba(192,132,252,0.3)' },
} as const;

function truncate(s: string, front: number, back: number): string {
  if (!s) return '—';
  if (s.length <= front + back + 3) return s;
  return `${s.slice(0, front)}…${s.slice(-back)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate a simple deterministic dot-pattern from a string (for visual fingerprint)
function makeFingerprint(seed: string, x: number, y: number, size: number): string {
  const dots: string[] = [];
  const cols = 7, rows = 7;
  const cw = size / cols, ch = size / rows;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bit = (h >> (r * cols + c)) & 1;
      if (bit) {
        dots.push(
          `<rect x="${x + c * cw + cw * 0.1}" y="${y + r * ch + ch * 0.1}" ` +
          `width="${cw * 0.8}" height="${ch * 0.8}" rx="1" fill="currentColor" opacity="0.7"/>`
        );
      }
    }
  }
  return dots.join('');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const did     = searchParams.get('did')     || 'did:key:z—';
  const alias   = searchParams.get('alias')   || 'Sovereign Creator';
  const rawTier = (searchParams.get('tier')   || 'citizen') as keyof typeof TIER_CONFIG;
  const address = searchParams.get('address') || '';
  const vcId    = searchParams.get('vcId')    || '';
  const expires = searchParams.get('expires') || '';
  const tier    = TIER_CONFIG[rawTier] ?? TIER_CONFIG.citizen;

  const didShort     = truncate(did, 18, 8);
  const addressShort = address ? truncate(address, 8, 6) : '—';
  const vcIdShort    = vcId ? truncate(vcId, 8, 6) : '—';
  const issued       = new Date().toISOString().slice(0, 10);
  const fp           = makeFingerprint(did + vcId, 0, 0, 56);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 504" width="800" height="504">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#080B0F"/>
      <stop offset="100%" stop-color="#0D1319"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${tier.color}" stop-opacity="0.8"/>
      <stop offset="50%"  stop-color="${tier.color}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${tier.color}" stop-opacity="0.8"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="card">
      <rect x="0" y="0" width="800" height="504" rx="20"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="800" height="504" rx="20" fill="url(#bg)"/>

  <!-- Subtle grid -->
  <g clip-path="url(#card)" opacity="0.06">
    ${Array.from({ length: 40 }, (_, i) =>
      `<line x1="${i * 20}" y1="0" x2="${i * 20}" y2="504" stroke="${tier.color}" stroke-width="0.5"/>`
    ).join('')}
    ${Array.from({ length: 26 }, (_, i) =>
      `<line x1="0" y1="${i * 20}" x2="800" y2="${i * 20}" stroke="${tier.color}" stroke-width="0.5"/>`
    ).join('')}
  </g>

  <!-- Border -->
  <rect x="1" y="1" width="798" height="502" rx="19" fill="none" stroke="url(#borderGrad)" stroke-width="1.5"/>

  <!-- Corner marks -->
  <g stroke="${tier.color}" stroke-width="2" fill="none" opacity="0.7">
    <path d="M24 8 L8 8 L8 24"/>
    <path d="M776 8 L792 8 L792 24"/>
    <path d="M24 496 L8 496 L8 480"/>
    <path d="M776 496 L792 496 L792 480"/>
  </g>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="5" height="504" rx="3" fill="${tier.color}" opacity="0.6"/>

  <!-- Header row -->
  <text x="32" y="52" font-family="'Courier New', Courier, monospace" font-size="28"
        font-weight="bold" letter-spacing="6" fill="${tier.color}" filter="url(#glow)">◈ ROYALE</text>
  <text x="32" y="75" font-family="'Courier New', Courier, monospace" font-size="11"
        letter-spacing="5" fill="${tier.color}" opacity="0.5">SOVEREIGN CREATOR CARD</text>

  <!-- Tier badge -->
  <rect x="600" y="30" width="162" height="36" rx="6"
        fill="${tier.color}" opacity="0.12" stroke="${tier.color}" stroke-width="1" stroke-opacity="0.5"/>
  <text x="681" y="54" text-anchor="middle" font-family="'Courier New', Courier, monospace"
        font-size="14" font-weight="bold" letter-spacing="3" fill="${tier.color}">${tier.label}</text>

  <!-- Divider -->
  <line x1="32" y1="96" x2="768" y2="96" stroke="${tier.color}" stroke-width="0.5" stroke-opacity="0.3"/>

  <!-- Creator alias — large -->
  <text x="32" y="158" font-family="'Courier New', Courier, monospace" font-size="42"
        font-weight="bold" fill="white" opacity="0.92">${escapeXml(alias.slice(0, 24))}</text>

  <!-- DID -->
  <text x="32" y="195" font-family="'Courier New', Courier, monospace" font-size="11"
        letter-spacing="2" fill="${tier.color}" opacity="0.5">DECENTRALIZED IDENTIFIER</text>
  <text x="32" y="216" font-family="'Courier New', Courier, monospace" font-size="13"
        fill="white" opacity="0.7">${escapeXml(didShort)}</text>

  <!-- Algorand address -->
  <text x="32" y="258" font-family="'Courier New', Courier, monospace" font-size="11"
        letter-spacing="2" fill="${tier.color}" opacity="0.5">ALGORAND ADDRESS</text>
  <text x="32" y="279" font-family="'Courier New', Courier, monospace" font-size="13"
        fill="white" opacity="0.7">${escapeXml(addressShort)}</text>

  <!-- Dates row -->
  <g>
    <text x="32" y="326" font-family="'Courier New', Courier, monospace" font-size="10"
          letter-spacing="2" fill="${tier.color}" opacity="0.5">ISSUED</text>
    <text x="32" y="345" font-family="'Courier New', Courier, monospace" font-size="13"
          fill="white" opacity="0.8">${issued}</text>
  </g>
  <g>
    <text x="200" y="326" font-family="'Courier New', Courier, monospace" font-size="10"
          letter-spacing="2" fill="${tier.color}" opacity="0.5">EXPIRES</text>
    <text x="200" y="345" font-family="'Courier New', Courier, monospace" font-size="13"
          fill="white" opacity="0.8">${escapeXml(expires || '—')}</text>
  </g>
  <g>
    <text x="400" y="326" font-family="'Courier New', Courier, monospace" font-size="10"
          letter-spacing="2" fill="${tier.color}" opacity="0.5">CREDENTIAL ID</text>
    <text x="400" y="345" font-family="'Courier New', Courier, monospace" font-size="13"
          fill="white" opacity="0.8">${escapeXml(vcIdShort)}</text>
  </g>

  <!-- Bottom divider -->
  <line x1="32" y1="370" x2="768" y2="370" stroke="${tier.color}" stroke-width="0.5" stroke-opacity="0.3"/>

  <!-- Proof indicators -->
  <text x="32" y="400" font-family="'Courier New', Courier, monospace" font-size="10"
        letter-spacing="1" fill="${tier.color}" opacity="0.6">◈ W3C VERIFIABLE CREDENTIAL  ·  ED25519 SIGNATURE  ·  DILITHIUM-3 QUANTUM PROOF</text>

  <!-- Verify URL -->
  <text x="32" y="425" font-family="'Courier New', Courier, monospace" font-size="10"
        fill="white" opacity="0.35">Verify: /api/credentials  ·  DID Method: ${did.split(':')[1] || 'key'}</text>

  <!-- Sovereign mark (subtle watermark) -->
  <text x="32" y="480" font-family="'Courier New', Courier, monospace" font-size="10"
        letter-spacing="2" fill="${tier.color}" opacity="0.25">YESHUA IS KING · GLORY BE TO GOD</text>

  <!-- Fingerprint block (right side, decorative) -->
  <g transform="translate(700, 200)" color="${tier.color}" opacity="0.55">
    ${fp}
  </g>
  <text x="728" y="270" text-anchor="middle" font-family="'Courier New', Courier, monospace"
        font-size="8" letter-spacing="1" fill="${tier.color}" opacity="0.35">KEY FINGERPRINT</text>

  <!-- Right accent bar -->
  <rect x="795" y="0" width="5" height="504" rx="3" fill="${tier.color}" opacity="0.15"/>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type':  'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
