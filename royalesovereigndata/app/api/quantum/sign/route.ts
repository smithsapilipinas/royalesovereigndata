import { NextRequest, NextResponse } from 'next/server';
import { quantumSign, DilithiumDSA, QuantumManifest } from '@/lib/quantum';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    switch (action) {

      // Generate a new Dilithium keypair (ephemeral — keys returned to client, never stored)
      case 'keygen': {
        const dsa = new DilithiumDSA();
        const keys = await dsa.generateKeys();
        return NextResponse.json({
          success: true,
          publicKey:  Buffer.from(keys.publicKey).toString('hex'),
          privateKey: Buffer.from(keys.secretKey).toString('hex'),
          algorithm: 'ML-DSA-65 (Dilithium-3)',
          nistLevel: 3,
          warning: 'Store your private key securely. Royale never stores private keys server-side.',
        });
      }

      // Sign a content hash
      case 'sign': {
        const { content, privateKeyHex } = payload;
        if (!content || !privateKeyHex) {
          return NextResponse.json({ error: 'content and privateKeyHex required' }, { status: 400 });
        }

        const contentBuf = typeof content === 'string'
          ? Buffer.from(content, 'utf-8')
          : Buffer.from(content);

        const contentHash = createHash('sha3-256').update(contentBuf).digest('hex');
        const secretKey   = Buffer.from(privateKeyHex, 'hex');

        const dsa = new DilithiumDSA();
        const signature = await dsa.sign(contentBuf, { publicKey: new Uint8Array(0), secretKey });

        return NextResponse.json({
          success: true,
          contentHash,
          signatureHex: Buffer.from(signature).toString('hex'),
          algorithm: 'ML-DSA-65 (FIPS 204)',
        });
      }

      // Verify a signature
      case 'verify': {
        const { content, signatureHex, publicKeyHex } = payload;
        if (!content || !signatureHex || !publicKeyHex) {
          return NextResponse.json({ error: 'content, signatureHex, publicKeyHex required' }, { status: 400 });
        }

        const contentBuf  = Buffer.from(content, 'utf-8');
        const signature   = Buffer.from(signatureHex, 'hex');
        const publicKey   = Buffer.from(publicKeyHex, 'hex');

        const dsa    = new DilithiumDSA();
        const valid  = await dsa.verify(contentBuf, signature, publicKey);

        return NextResponse.json({
          success: true,
          valid,
          algorithm: 'ML-DSA-65 (FIPS 204)',
        });
      }

      // Create a quantum manifest for a CID
      case 'manifest': {
        const { cid, creatorAddress, metadata } = payload;
        if (!cid) {
          return NextResponse.json({ error: 'cid required' }, { status: 400 });
        }

        const manifest = await QuantumManifest.create(
          Buffer.from(cid, 'utf-8'),
          creatorAddress || 'anonymous',
          metadata || {}
        );

        return NextResponse.json({ success: true, manifest });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

  } catch (err) {
    console.error('[quantum/sign]', err);
    return NextResponse.json(
      { error: 'Quantum operation failed', details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'QUANTUM SHIELD ONLINE',
    algorithms: {
      kem: 'CRYSTALS-Kyber-1024 (ML-KEM, FIPS 203)',
      dsa: 'CRYSTALS-Dilithium-3 (ML-DSA, FIPS 204)',
      hash: 'SHAKE-256 / SHA3-256 (FIPS 202)',
    },
    nistLevel: 5,
    actions: ['keygen', 'sign', 'verify', 'manifest'],
  });
}
