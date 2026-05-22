/**
 * ROYALE — API ROUTE: /api/credentials
 *
 * GET  /api/credentials?did=did:key:z... — resolve a DID document
 * POST /api/credentials                  — issue a Royale Creator Credential
 * PUT  /api/credentials                  — verify a credential
 *
 * ISSUER KEY:
 *   The platform maintains a stable Ed25519 keypair as the VC issuer.
 *   Set ROYALE_DID_PRIVATE_KEY and ROYALE_DID_PUBLIC_KEY in .env.local.
 *   Run GET /api/credentials/setup once to generate and display these values.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateDIDKey, deriveEthDID, resolveDIDKey, reconstructDIDKey, type DIDKeyPair } from '@/lib/did';
import {
  issueCredential,
  verifyCredential,
  type CredentialSubject,
  type CredentialType,
  type VerifiableCredential,
} from '@/lib/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ─── ISSUER KEY MANAGEMENT ────────────────────────────────────────────────────

let _cachedIssuerKey: DIDKeyPair | null = null;

function getIssuerKey(): DIDKeyPair {
  if (_cachedIssuerKey) return _cachedIssuerKey;

  const privateKeyHex = process.env.ROYALE_DID_PRIVATE_KEY;
  const publicKeyHex  = process.env.ROYALE_DID_PUBLIC_KEY;

  if (privateKeyHex && publicKeyHex) {
    _cachedIssuerKey = reconstructDIDKey(publicKeyHex, privateKeyHex);
  } else {
    // No key configured — generate ephemeral (dev only; VCs won't persist across restarts)
    console.warn('[DID] No ROYALE_DID_PRIVATE_KEY set. Generating ephemeral key. Set env vars for production.');
    _cachedIssuerKey = generateDIDKey();
  }

  return _cachedIssuerKey;
}

// ─── GET — resolve DID or return issuer info ──────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const did    = searchParams.get('did');
  const setup  = searchParams.get('setup');

  // ?setup=1 — generate a new issuer keypair (run once, save to .env.local)
  if (setup) {
    const newKey = generateDIDKey();
    return NextResponse.json({
      message:        'Add these to .env.local — keep ROYALE_DID_PRIVATE_KEY secret',
      ROYALE_DID_PRIVATE_KEY: newKey.privateKeyHex,
      ROYALE_DID_PUBLIC_KEY:  newKey.publicKeyHex,
      issuerDID:              newKey.did,
    }, { headers: CORS });
  }

  // ?did=... — resolve a DID document
  if (did) {
    if (did.startsWith('did:key:')) {
      const doc = resolveDIDKey(did);
      if (!doc) return NextResponse.json({ error: 'Cannot resolve DID' }, { status: 400, headers: CORS });
      return NextResponse.json({ didDocument: doc }, { headers: CORS });
    }
    if (did.startsWith('did:ethr:')) {
      // did:ethr resolution is trivially derived from the address
      const address = did.split(':').pop() || '';
      const key = deriveEthDID(address);
      return NextResponse.json({ didDocument: key.document }, { headers: CORS });
    }
    return NextResponse.json({ error: 'Unsupported DID method' }, { status: 400, headers: CORS });
  }

  // Default: return issuer DID (public info only)
  const issuer = getIssuerKey();
  return NextResponse.json({
    issuerDID:          issuer.did,
    issuerPublicKeyHex: issuer.publicKeyHex,
    supportedTypes:     ['RoyaleCreatorCredential', 'RoyaleTierCredential', 'RoyaleContentCredential'],
    didMethods:         ['did:key', 'did:ethr'],
    vcDataModel:        '1.1',
  }, { headers: CORS });
}

// ─── POST — issue a credential ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      holderDID:        string;
      type?:            CredentialType;
      subject:          Omit<CredentialSubject, 'id'>;
      expiresInDays?:   number;
    };

    const { holderDID, subject, type = 'RoyaleCreatorCredential', expiresInDays } = body;

    if (!holderDID) {
      return NextResponse.json({ error: 'holderDID is required' }, { status: 400, headers: CORS });
    }
    if (!subject?.royaleAlias) {
      return NextResponse.json({ error: 'subject.royaleAlias is required' }, { status: 400, headers: CORS });
    }

    const issuerKey  = getIssuerKey();
    const credential = issueCredential(
      { ...subject, id: holderDID },
      type,
      issuerKey,
      { expiresInDays }
    );

    // Card URL for embedding / sharing
    const params = new URLSearchParams({
      did:     holderDID,
      alias:   subject.royaleAlias,
      tier:    subject.tier ?? 'citizen',
      address: subject.algorandAddress ?? '',
      vcId:    credential.id,
      expires: credential.expirationDate?.slice(0, 10) ?? '',
    });
    const cardUrl = `/api/credentials/card?${params}`;

    return NextResponse.json({
      credential,
      cardUrl,
      issuerPublicKeyHex: issuerKey.publicKeyHex,
      note: 'Store the credential and issuerPublicKeyHex — both are needed for offline verification.',
    }, { status: 201, headers: CORS });

  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500, headers: CORS });
  }
}

// ─── PUT — verify a credential ────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as {
      credential:        VerifiableCredential;
      issuerPublicKeyHex?: string;
    };

    if (!body.credential) {
      return NextResponse.json({ error: 'credential is required' }, { status: 400, headers: CORS });
    }

    // Use provided public key, or fall back to current issuer key
    const pubHex  = body.issuerPublicKeyHex ?? getIssuerKey().publicKeyHex;
    const result  = verifyCredential(body.credential, pubHex);

    return NextResponse.json({ result }, {
      status:  result.valid ? 200 : 422,
      headers: CORS,
    });

  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500, headers: CORS });
  }
}
