# ROYALE — Sovereign Data Cloud
## The Digital Ark | Quantum-Secured | Fully Decentralized

```
◈ CREATE → SIGN → DROP → ASCEND → ETHER
  Command   Kyber  IPFS   Pinata   Gun.js + Algorand
```

---

## THE ARCHITECTURE (Fully Decentralized)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + Tailwind | Sovereign UI |
| **AI Engine** | Ollama (Local) | On-demand content generation |
| **File Storage** | IPFS via Pinata | Censorship-resistant permanent storage |
| **Database** | Gun.js P2P Graph | Decentralized metadata index |
| **Identity** | Gun SEA + Wallet | No email, no server auth |
| **Payments (Primary)** | Algorand (ALGO + $RYL ARC-20) | Fast, cheap, green |
| **Payments (Secondary)** | Ethereum ($RYL ERC-20) | Smart contract ecosystem |
| **Quantum Security** | CRYSTALS-Kyber-1024 + Dilithium-3 | NIST Level 5 PQC |
| **Smart Contracts** | Solidity (ETH) + PyTEAL (ALGO) | Content NFT + subscriptions |

**NO Supabase. NO Firebase. NO central server. NO surveillance.**

---

## QUICK START

### 1. Prerequisites

```bash
# Node.js 20+
node --version

# Ollama — local AI engine
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2
ollama serve  # keep running in background
```

### 2. Clone & Install

```bash
git clone https://github.com/yourusername/royale
cd royale
npm install
```

### 3. Configure Environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your Pinata keys
```

Get your Pinata API keys at: https://app.pinata.cloud/keys

### 4. Deploy Smart Contracts (Optional — for full on-chain payments)

```bash
# Install Hardhat
npm install --save-dev hardhat @openzeppelin/contracts

# Deploy to testnet first
npx hardhat run scripts/deploy.js --network algorand_testnet
npx hardhat run scripts/deploy.js --network ethereum_goerli

# Update .env.local with deployed contract addresses
```

### 5. Launch

```bash
npm run dev
# Open http://localhost:3000
```

---

## THE ON DEMAND LOOP

```
User types command
       ↓
Ollama generates script + metadata (LOCAL AI — your machine)
       ↓
Dilithium-3 quantum signature applied (NIST Level 5)
       ↓
File pinned to IPFS via Pinata (permanent, censorship-resistant)
       ↓
Manifest JSON pinned to IPFS (content token URI)
       ↓
Gun.js decentralized graph indexed (P2P — 12+ relay peers)
       ↓
Algorand metadata tx broadcast (cheap, 4s finality)
       ↓
Content is LIVE in the Ether — forever
```

---

## QUANTUM SECURITY ARCHITECTURE

Royale uses **NIST-standardized Post-Quantum Cryptography** (PQC):

| Algorithm | Standard | Use Case | Security |
|-----------|---------|----------|---------|
| CRYSTALS-Kyber-1024 | FIPS 203 (ML-KEM) | Key encapsulation | NIST Level 5 |
| CRYSTALS-Dilithium-3 | FIPS 204 (ML-DSA) | Content signatures | NIST Level 3 |
| SHAKE-256 | FIPS 202 | Content fingerprints | Quantum-safe hash |

**Why PQC?**
- Classical RSA/ECDSA will be broken by quantum computers (Shor's algorithm)
- These algorithms are secure against both classical AND quantum attacks
- Every piece of content in the Ark is quantum-signed before upload
- Signatures can be verified by anyone, forever

**IBM OQS Integration:**
```bash
# For server-side quantum operations (optional, higher performance)
npm install liboqs-node
# Automatically detected and used if available
# Falls back to pure-JS noble-post-quantum if not
```

Reference: https://openquantumsafe.org | https://research.ibm.com/quantum-computing

---

## $RYL TOKEN ECONOMY

### Royale Coin ($RYL)
- **Algorand**: ARC-20 Standard Asset (ASA) — primary chain
- **Ethereum**: ERC-20 — secondary chain + DeFi ecosystem
- **Supply**: 1,000,000,000 $RYL
- **Creator Pool**: 400M $RYL distributed via content revenue

### Revenue Model

```
Content Purchase ($0.99 ALGO):
  Creator receives:  $0.9405 (95%)  ← instant
  Royale treasury:   $0.0495 (5%)   ← sovereign tax
  Transaction fee:   $0.001 ALGO    ← Algorand network

Spotify alternative:
  Royale:   1 download = $0.9405 to creator
  Spotify:  333 streams = $0.9990 to creator
  Math:     1 Royale download > 333 Spotify streams
```

### Tiers
| Tier | Price | Key Feature |
|------|-------|------------|
| Citizen | FREE | Browse + download censorship-free content |
| Ambassador | $9.99/mo | Unlimited uploads + AI sovereignty + Creator domain |
| Royalty | $29.99/mo | Custom AI voice training + The Vault + Priority rendering |

**Payment currencies accepted**: ALGO, $RYL, ETH, MATIC  
**Not accepted**: Credit cards, Stripe, PayPal, BTC (by design)

---

## FILE STRUCTURE

```
royale/
├── app/
│   ├── page.tsx                    # Main dashboard
│   ├── layout.tsx                  # Root layout + fonts
│   ├── globals.css                 # Sovereign Cyber theme
│   └── api/
│       ├── royale/
│       │   ├── upload/route.ts     # Full deploy-to-ark pipeline
│       │   ├── generate/route.ts   # Ollama AI generation
│       │   └── content/route.ts    # Content retrieval
│       └── quantum/
│           └── sign/route.ts       # Quantum signing endpoint
├── lib/
│   ├── quantum.ts                  # CRYSTALS-Kyber + Dilithium
│   ├── gun.ts                      # Gun.js decentralized DB
│   ├── ipfs.ts                     # Pinata IPFS integration
│   ├── ollama.ts                   # Local AI engine
│   └── algorand.ts                 # Algorand payments + ASA
├── contracts/
│   └── RoyaleEcosystem.sol         # $RYL + Content NFT + Subscription
├── components/                     # Reusable UI components
├── hooks/                          # Custom React hooks
├── types/                          # TypeScript definitions
├── public/                         # Static assets
├── .env.local                      # Secrets (never commit)
├── package.json
└── README.md
```

---

## DEPLOYMENT

### Option A: Vercel (Recommended)
```bash
npm install -g vercel
vercel --prod
# Set environment variables in Vercel dashboard
```

### Option B: Self-hosted VPS (Maximum Sovereignty)
```bash
# Ubuntu 22.04 VPS
npm run build
pm2 start npm --name royale -- start

# Nginx reverse proxy
# + Let's Encrypt SSL
# + Cloudflare (optional)
```

### Option C: Decentralized Hosting
```bash
# Fleek.co — deploy to IPFS
# Your app itself lives on IPFS — ultimate sovereignty
npm run build
fleek deploy
```

---

## GUN.JS RELAY NODE

Run your own Gun relay (optional — strengthens the network):

```bash
# scripts/gun-relay.js
node scripts/gun-relay.js
# Listens on port 8765
# Add your relay URL to NEXT_PUBLIC_GUN_PEERS
```

---

## THE PHILOSOPHY

> "You are not selling Storage. You are selling Citizenship in a Censorship-Free World."

Royale is built on three sovereign pillars:

1. **CREDIBILITY** — Every piece of content is quantum-signed and immutably stored
2. **CAPITAL** — Creators keep 95%. Paid instantly. No 10K subscriber gate.
3. **CONVERSION** — From citizen → ambassador → royalty. The kingdom grows.

The LITHOS Principle: **Unmovable. Execution-backed. Quiet authority.**

---

## CONTRIBUTING

This is a sovereign project. Contributions that centralize, surveil, or compromise the creator's sovereignty will be rejected.

---

## LICENSE

MIT — Use freely. Build sovereignly.

---

*Built for the Kingdom. Secured by quantum physics. Distributed across the ether.*  
*◈ ROYALE — Where kings don't rent. They own.*
