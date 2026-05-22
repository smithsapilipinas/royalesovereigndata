/**
 * ROYALE — Decentralized Identifiers (DID)
 *
 * Implements two DID methods:
 *
 *   did:key  — Self-contained. No registry, no blockchain, no server.
 *              Derived entirely from an Ed25519 keypair.
 *              Format: did:key:z<base58btc(0xed01 + raw_pubkey)>
 *
 *   did:ethr — Ethereum address as identity.
 *              Format: did:ethr:0x<checksummed_address>
 *              Works with any connected Ethereum wallet.
 *
 * Both are W3C DID spec compliant.
 * Keys are generated server-side; private keys never leave the response
 * (clients should store them in localStorage and treat them as secrets).
 */

import { createHash, generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify } from 'crypto';
import { getAddress } from 'ethers';

// ─── BASE58BTC ────────────────────────────────────────────────────────────────
// Used by did:key for multibase encoding (prefix 'z' = base58btc)

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58btcEncode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);

  let out = '';
  while (n > 0n) {
    out = B58_ALPHABET[Number(n % 58n)] + out;
    n = n / 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

export function base58btcDecode(str: string): Uint8Array {
  let n = 0n;
  for (const ch of str) {
    const idx = B58_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid base58 character: ${ch}`);
    n = n * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const ch of str) {
    if (ch !== '1') break;
    bytes.unshift(0);
  }
  return new Uint8Array(bytes);
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface DIDKeyPair {
  did:            string;
  method:         'key' | 'ethr';
  publicKeyMultibase:  string;   // z<base58btc>
  publicKeyHex:        string;
  privateKeyHex?:      string;   // keep secret — never log or transmit
  document:            DIDDocument;
  createdAt:           string;
}

export interface DIDDocument {
  '@context':         string[];
  id:                 string;
  verificationMethod: VerificationMethod[];
  authentication:     string[];
  assertionMethod:    string[];
  keyAgreement?:      string[];
}

export interface VerificationMethod {
  id:                  string;
  type:                string;
  controller:          string;
  publicKeyMultibase?: string;
  blockchainAccountId?: string;
}

// ─── did:key (Ed25519) ────────────────────────────────────────────────────────
// Multicodec prefix for Ed25519 public key: 0xed 0x01 (varint)

const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

/**
 * Extract raw 32-byte public key from Node.js Ed25519 SPKI DER buffer.
 * SPKI DER structure: 12-byte header + 32 bytes raw key
 */
function spkiToRawEd25519(spkiDer: Buffer): Uint8Array {
  // The SPKI header for Ed25519 is always exactly 12 bytes:
  // 30 2a 30 05 06 03 2b 65 70 03 21 00
  if (spkiDer.length !== 44) throw new Error(`Unexpected Ed25519 SPKI length: ${spkiDer.length}`);
  return new Uint8Array(spkiDer.slice(12)); // bytes 12-43 are the raw 32-byte key
}

export function generateDIDKey(): DIDKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding:  { type: 'spki',  format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  const rawPub        = spkiToRawEd25519(publicKey as unknown as Buffer);
  const multicodecKey = new Uint8Array(ED25519_MULTICODEC.length + rawPub.length);
  multicodecKey.set(ED25519_MULTICODEC);
  multicodecKey.set(rawPub, ED25519_MULTICODEC.length);

  const encoded           = base58btcEncode(multicodecKey);
  const publicKeyMultibase = `z${encoded}`;
  const did               = `did:key:${publicKeyMultibase}`;
  const vmId              = `${did}#${publicKeyMultibase}`;

  const document: DIDDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id:                 vmId,
        type:               'Ed25519VerificationKey2020',
        controller:         did,
        publicKeyMultibase: publicKeyMultibase,
      },
    ],
    authentication:  [vmId],
    assertionMethod: [vmId],
  };

  return {
    did,
    method:              'key',
    publicKeyMultibase,
    publicKeyHex:        Buffer.from(rawPub).toString('hex'),
    privateKeyHex:       (privateKey as unknown as Buffer).toString('hex'),
    document,
    createdAt:           new Date().toISOString(),
  };
}

// ─── did:ethr (Ethereum address) ─────────────────────────────────────────────

export function deriveEthDID(ethereumAddress: string, chainId?: number): DIDKeyPair {
  const checksummed = getAddress(ethereumAddress);
  const chainPrefix = chainId ? `0x${chainId.toString(16)}:` : '';
  const did         = `did:ethr:${chainPrefix}${checksummed}`;
  const vmId        = `${did}#controller`;

  const document: DIDDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/eip712sig-2021/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id:                   vmId,
        type:                 'EcdsaSecp256k1RecoveryMethod2020',
        controller:           did,
        blockchainAccountId:  `${checksummed}@eip155:${chainId ?? 1}`,
      },
    ],
    authentication:  [vmId],
    assertionMethod: [vmId],
  };

  return {
    did,
    method:              'ethr',
    publicKeyMultibase:  '',  // derived from wallet — not stored here
    publicKeyHex:        '',
    document,
    createdAt:           new Date().toISOString(),
  };
}

// ─── DID signing (for VC proof generation) ───────────────────────────────────

/**
 * Sign data using an Ed25519 private key (from generateDIDKey).
 * Returns base64url-encoded signature.
 */
export function didSign(data: string, privateKeyHex: string): string {
  const keyDer    = Buffer.from(privateKeyHex, 'hex');
  const dataBytes = Buffer.from(data, 'utf8');
  // Node crypto.sign with Ed25519 PKCS8 DER key
  const sig = cryptoSign(null, dataBytes, { key: keyDer, format: 'der', type: 'pkcs8' });
  return sig.toString('base64url');
}

/**
 * Verify an Ed25519 signature.
 */
export function didVerify(data: string, signatureBase64url: string, publicKeyHex: string): boolean {
  try {
    const rawPub    = Buffer.from(publicKeyHex, 'hex');
    // Re-wrap raw public key in SPKI DER format
    const spkiHeader = Buffer.from('302a300506032b657003210000', 'hex');
    // Fix: last byte of header is 0x00 (unused bits) — raw key follows
    const spkiDer   = Buffer.concat([Buffer.from('302a300506032b65700321 00'.replace(/\s/g,''), 'hex'), rawPub]);
    const dataBytes = Buffer.from(data, 'utf8');
    const sigBytes  = Buffer.from(signatureBase64url, 'base64url');
    return cryptoVerify(null, dataBytes, { key: spkiDer, format: 'der', type: 'spki' }, sigBytes);
  } catch {
    return false;
  }
}

// ─── DID Resolution ──────────────────────────────────────────────────────────

export function resolveDIDKey(did: string): DIDDocument | null {
  if (!did.startsWith('did:key:z')) return null;
  const multibase = did.slice('did:key:'.length);  // z<encoded>
  const vmId      = `${did}#${multibase}`;
  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    verificationMethod: [{
      id:                 vmId,
      type:               'Ed25519VerificationKey2020',
      controller:         did,
      publicKeyMultibase: multibase,
    }],
    authentication:  [vmId],
    assertionMethod: [vmId],
  };
}

// ─── RECONSTRUCT from stored keys ────────────────────────────────────────────

/**
 * Rebuild a DIDKeyPair from stored privateKeyHex + publicKeyHex env vars.
 * Use this to restore the platform issuer key across server restarts.
 */
export function reconstructDIDKey(publicKeyHex: string, privateKeyHex: string): DIDKeyPair {
  const rawPub         = Buffer.from(publicKeyHex, 'hex');
  const multicodecKey  = new Uint8Array(ED25519_MULTICODEC.length + rawPub.length);
  multicodecKey.set(ED25519_MULTICODEC);
  multicodecKey.set(rawPub, ED25519_MULTICODEC.length);

  const encoded            = base58btcEncode(multicodecKey);
  const publicKeyMultibase = `z${encoded}`;
  const did                = `did:key:${publicKeyMultibase}`;
  const vmId               = `${did}#${publicKeyMultibase}`;

  return {
    did,
    method: 'key',
    publicKeyMultibase,
    publicKeyHex,
    privateKeyHex,
    document: {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: did,
      verificationMethod: [{
        id: vmId, type: 'Ed25519VerificationKey2020', controller: did, publicKeyMultibase,
      }],
      authentication:  [vmId],
      assertionMethod: [vmId],
    },
    createdAt: new Date().toISOString(),
  };
}
