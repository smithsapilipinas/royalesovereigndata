/**
 * ROYALE — W3C Verifiable Credentials
 *
 * Issues cryptographically signed credentials to Royale creators.
 * Credentials follow the W3C Verifiable Credentials Data Model 1.1.
 *
 * CREDENTIAL TYPES:
 *   RoyaleCreatorCredential  — Proves membership in the Royale ecosystem
 *   RoyaleTierCredential     — Proves current subscription tier
 *   RoyaleContentCredential  — Proves authorship of a specific content CID
 *
 * PROOF METHOD:
 *   Ed25519Signature2020 — NIST-compatible, widely supported
 *   Signed with the platform's did:key issuer key
 *   Verification key is public — anyone can verify without contacting Royale
 *
 * STORAGE:
 *   Credentials are returned to the holder and optionally pinned to IPFS.
 *   Royale does not maintain a centralized credential registry.
 */

import { createHash, randomUUID } from 'crypto';
import { didSign, didVerify, type DIDKeyPair } from './did';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type CredentialType =
  | 'RoyaleCreatorCredential'
  | 'RoyaleTierCredential'
  | 'RoyaleContentCredential';

export interface CredentialSubject {
  id: string;                     // holder's DID
  royaleAlias:     string;
  tier:            'citizen' | 'ambassador' | 'royalty';
  algorandAddress?: string;
  ethAddress?:     string;
  contentCount?:   number;
  joinedAt?:       string;        // ISO date
  // Content credential fields
  contentCid?:     string;
  contentTitle?:   string;
  // Sovereign mark
  sovereignMark?:  string;
}

export interface VerifiableCredential {
  '@context':       string[];
  type:             string[];
  id:               string;
  issuer:           string;       // platform's DID
  issuanceDate:     string;
  expirationDate?:  string;
  credentialSubject: CredentialSubject;
  proof:            CredentialProof;
}

export interface CredentialProof {
  type:               string;
  cryptosuite:        string;
  created:            string;
  verificationMethod: string;     // did:key:z...#z...
  proofPurpose:       string;
  proofValue:         string;     // base64url Ed25519 signature
  // Non-standard but useful: hash of the unsigned credential
  credentialHash:     string;
}

export interface VerificationResult {
  valid:         boolean;
  expired:       boolean;
  issuer:        string;
  subject:       string;
  tier?:         string;
  verifiedAt:    string;
  error?:        string;
}

// ─── SIGNING HELPERS ──────────────────────────────────────────────────────────

/**
 * Produce a deterministic canonical string for signing.
 * We sign over sorted-key JSON of the credential (minus the proof field).
 * This is a simplified canonicalization — production should use JSON-LD URDNA2015.
 */
function canonicalize(obj: Record<string, unknown>): string {
  const sorted = Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      const v = obj[k];
      acc[k] = v && typeof v === 'object' && !Array.isArray(v)
        ? JSON.parse(canonicalize(v as Record<string, unknown>))
        : v;
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

function credentialHash(unsigned: Omit<VerifiableCredential, 'proof'>): string {
  return createHash('sha256')
    .update(canonicalize(unsigned as unknown as Record<string, unknown>))
    .digest('hex');
}

// ─── ISSUE ────────────────────────────────────────────────────────────────────

export function issueCredential(
  subject:   CredentialSubject,
  type:      CredentialType,
  issuerKey: DIDKeyPair,
  options: {
    expiresInDays?: number;  // default 365
    credentialId?:  string;
  } = {}
): VerifiableCredential {
  if (!issuerKey.privateKeyHex) {
    throw new Error('Issuer private key required for signing');
  }

  const now        = new Date();
  const expiry     = new Date(now);
  expiry.setDate(expiry.getDate() + (options.expiresInDays ?? 365));

  const vmId       = `${issuerKey.did}#${issuerKey.publicKeyMultibase}`;
  const credId     = options.credentialId ?? `urn:uuid:${randomUUID()}`;

  const unsigned: Omit<VerifiableCredential, 'proof'> = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://royale.io/credentials/v1',
    ],
    type:      ['VerifiableCredential', type],
    id:        credId,
    issuer:    issuerKey.did,
    issuanceDate:    now.toISOString(),
    expirationDate:  expiry.toISOString(),
    credentialSubject: {
      ...subject,
      sovereignMark: subject.sovereignMark ?? 'Yeshua is King · Royale',
    },
  };

  const hash = credentialHash(unsigned);
  const payload = canonicalize(unsigned as unknown as Record<string, unknown>);
  const proofValue = didSign(payload, issuerKey.privateKeyHex);

  return {
    ...unsigned,
    proof: {
      type:               'DataIntegrityProof',
      cryptosuite:        'eddsa-2022',
      created:            now.toISOString(),
      verificationMethod: vmId,
      proofPurpose:       'assertionMethod',
      proofValue,
      credentialHash:     hash,
    },
  };
}

// ─── VERIFY ───────────────────────────────────────────────────────────────────

export function verifyCredential(
  vc:            VerifiableCredential,
  issuerPubHex?: string          // optional — extracted from proof if omitted
): VerificationResult {
  const now = new Date();

  try {
    // Check expiry
    const expired = vc.expirationDate
      ? new Date(vc.expirationDate) < now
      : false;

    // Reconstruct the unsigned credential
    const { proof, ...unsigned } = vc;
    const payload = canonicalize(unsigned as unknown as Record<string, unknown>);

    // Recompute hash
    const expectedHash = credentialHash(unsigned);
    if (proof.credentialHash && proof.credentialHash !== expectedHash) {
      return {
        valid:      false,
        expired,
        issuer:     vc.issuer,
        subject:    vc.credentialSubject.id,
        verifiedAt: now.toISOString(),
        error:      'Credential hash mismatch — content may have been tampered',
      };
    }

    // Extract public key from verificationMethod (did:key)
    let pubHex = issuerPubHex;
    if (!pubHex) {
      // Try to extract from the did:key in verificationMethod
      const vmDid = proof.verificationMethod.split('#')[0];
      if (vmDid.startsWith('did:key:z')) {
        // We need the publicKeyHex — callers should pass it or store it from issuance
        return {
          valid:      false,
          expired,
          issuer:     vc.issuer,
          subject:    vc.credentialSubject.id,
          verifiedAt: now.toISOString(),
          error:      'Provide issuerPubHex to verify without full key resolution',
        };
      }
    }

    const valid = pubHex
      ? didVerify(payload, proof.proofValue, pubHex)
      : false;

    return {
      valid:      valid && !expired,
      expired,
      issuer:     vc.issuer,
      subject:    vc.credentialSubject.id,
      tier:       vc.credentialSubject.tier,
      verifiedAt: now.toISOString(),
      error:      expired ? 'Credential expired' : valid ? undefined : 'Invalid signature',
    };
  } catch (e) {
    return {
      valid:      false,
      expired:    false,
      issuer:     vc.issuer || 'unknown',
      subject:    vc.credentialSubject?.id || 'unknown',
      verifiedAt: now.toISOString(),
      error:      (e as Error).message,
    };
  }
}
