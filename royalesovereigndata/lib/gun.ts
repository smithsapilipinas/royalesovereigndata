/**
 * ROYALE — DECENTRALIZED DATABASE (Gun.js)
 *
 * Gun.js is a P2P graph database.
 * Data is replicated across ALL peers — no single server, no central DB.
 * Replaces Supabase/PostgreSQL entirely.
 *
 * Architecture:
 *   - Every user IS a relay node (peer-to-peer)
 *   - Data syncs across the network in real-time
 *   - Falls back to localStorage for offline-first support
 *   - IPFS CIDs are the primary content addresses
 *   - Gun graph stores metadata, not the actual files
 *
 * Docs: https://gun.eco/docs
 */

import Gun from 'gun';
import 'gun/sea';      // Gun's built-in SEA crypto (for identity)
import 'gun/lib/path';
import 'gun/lib/not';
import 'gun/lib/open';
import 'gun/lib/load';

// ─── CONFIGURATION ───────────────────────────────────────────────────────────

const GUN_PEERS = (process.env.NEXT_PUBLIC_GUN_PEERS || '')
  .split(',')
  .map(p => p.trim())
  .filter(Boolean);

// Default public relay peers (community-run, always-on)
const DEFAULT_PEERS = [
  'https://gun-relay.ecko.me/gun',
  'https://gun-us.herokuapp.com/gun',
  'https://gundb-relay.militarymemo.com/gun',
];

// ─── GUN INSTANCE (singleton) ────────────────────────────────────────────────

let _gun: any = null;

export function getGun(): any {
  if (_gun) return _gun;

  const peers = GUN_PEERS.length > 0 ? GUN_PEERS : DEFAULT_PEERS;

  _gun = Gun({
    peers,
    localStorage: typeof window !== 'undefined',
    radisk: false,   // disable for browser
    multicast: false,
  });

  return _gun;
}

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export interface RoyaleContent {
  id: string;
  title: string;
  description: string;
  contentType: 'music' | 'video' | 'text' | 'image' | 'mixed';
  ipfsCid: string;
  ipfsGatewayUrl: string;
  creator: string;         // wallet address
  creatorAlias: string;
  priceMicro: number;      // price in micro-ALGO (0 = free)
  currency: 'ALGO' | 'ETH' | 'RYL' | 'FREE';
  tags: string[];
  language: string;
  region: string;
  aiGenerated: boolean;
  ollamaModel?: string;
  quantumSig: string;      // Dilithium-3 hex signature
  quantumPubKey: string;   // Creator's Dilithium public key
  nistLevel: number;
  createdAt: number;
  updatedAt: number;
  playCount: number;
  downloadCount: number;
  royaleNode: string;      // gun node path
}

export interface RoyaleUser {
  walletAddress: string;
  alias: string;
  tier: 'citizen' | 'ambassador' | 'royalty';
  quantumPubKey: string;
  algorandAddress?: string;
  ethAddress?: string;
  joinedAt: number;
  contentCount: number;
  totalRevenue: number;
}

// ─── CONTENT OPERATIONS ──────────────────────────────────────────────────────

export class RoyaleDB {
  private gun: any;
  private content: any;
  private users: any;
  private analytics: any;

  constructor() {
    this.gun = getGun();
    this.content = this.gun.get('royale/v1/content');
    this.users = this.gun.get('royale/v1/users');
    this.analytics = this.gun.get('royale/v1/analytics');
  }

  /**
   * Save content metadata to the decentralized Gun graph
   * The actual file lives on IPFS — Gun stores the index
   */
  async putContent(record: RoyaleContent): Promise<string> {
    return new Promise((resolve, reject) => {
      const node = this.content.get(record.id);
      node.put(
        {
          ...record,
          tags: JSON.stringify(record.tags),   // Gun doesn't do arrays natively
          updatedAt: Date.now(),
        },
        (ack: any) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve(record.id);
        }
      );
    });
  }

  /**
   * Get a single content record by ID
   */
  async getContent(id: string): Promise<RoyaleContent | null> {
    return new Promise((resolve) => {
      this.content.get(id).once((data: any) => {
        if (!data) { resolve(null); return; }
        resolve({
          ...data,
          tags: JSON.parse(data.tags || '[]'),
        } as RoyaleContent);
      });
    });
  }

  /**
   * List all content — real-time streaming
   * Calls callback every time data changes (live sync)
   */
  onContentList(
    callback: (items: RoyaleContent[]) => void,
    limit = 50
  ): () => void {
    const items: Map<string, RoyaleContent> = new Map();

    const unsubscribe = this.content.map().on((data: any, key: string) => {
      if (data && key) {
        items.set(key, {
          ...data,
          tags: JSON.parse(data.tags || '[]'),
        } as RoyaleContent);

        const sorted = Array.from(items.values())
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, limit);

        callback(sorted);
      }
    });

    return () => unsubscribe?.off?.();
  }

  /**
   * Search by tag — Gun.js full-graph search
   * For production, augment with a local index in IndexedDB
   */
  async searchByTag(tag: string): Promise<RoyaleContent[]> {
    return new Promise((resolve) => {
      const results: RoyaleContent[] = [];
      this.content.map().once((data: any) => {
        if (data?.tags?.includes(tag)) {
          results.push({ ...data, tags: JSON.parse(data.tags || '[]') });
        }
      });
      setTimeout(() => resolve(results), 1500);
    });
  }

  /**
   * Increment play count — decentralized analytics
   */
  async incrementPlay(id: string): Promise<void> {
    const node = this.content.get(id);
    node.once((data: any) => {
      if (data) {
        node.get('playCount').put((data.playCount || 0) + 1);
      }
    });
  }

  /**
   * Increment download count
   */
  async incrementDownload(id: string): Promise<void> {
    const node = this.content.get(id);
    node.once((data: any) => {
      if (data) {
        node.get('downloadCount').put((data.downloadCount || 0) + 1);
      }
    });
  }

  // ─── USER OPERATIONS ──────────────────────────────────────────────────────

  async putUser(user: RoyaleUser): Promise<void> {
    return new Promise((resolve, reject) => {
      this.users.get(user.walletAddress).put(user, (ack: any) => {
        if (ack.err) reject(new Error(ack.err));
        else resolve();
      });
    });
  }

  async getUser(walletAddress: string): Promise<RoyaleUser | null> {
    return new Promise((resolve) => {
      this.users.get(walletAddress).once((data: any) => {
        resolve(data || null);
      });
    });
  }

  onUser(walletAddress: string, callback: (user: RoyaleUser) => void): () => void {
    const unsub = this.users.get(walletAddress).on((data: any) => {
      if (data) callback(data as RoyaleUser);
    });
    return () => unsub?.off?.();
  }

  // ─── ANALYTICS — Decentralized Event Tracking ─────────────────────────────

  async trackEvent(event: {
    type: 'play' | 'download' | 'purchase' | 'upload' | 'join';
    contentId?: string;
    walletAddress?: string;
    region?: string;
    amount?: number;
    currency?: string;
  }): Promise<void> {
    const id = `${event.type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.analytics.get(id).put({
      ...event,
      timestamp: Date.now(),
    });
  }

  // ─── REAL-TIME NATION COUNTER ─────────────────────────────────────────────

  onNationCount(callback: (count: number) => void): () => void {
    const nations = new Set<string>();
    const unsub = this.analytics.map().on((data: any) => {
      if (data?.region) {
        nations.add(data.region);
        callback(nations.size);
      }
    });
    return () => unsub?.off?.();
  }
}

// Singleton export
export const db = new RoyaleDB();

// ─── GUN SEA IDENTITY (Decentralized Auth) ───────────────────────────────────

export class GunIdentity {
  private gun: any;
  private user: any;

  constructor() {
    this.gun = getGun();
    this.user = this.gun.user();
  }

  /**
   * Create a new sovereign identity
   * Gun SEA generates keys from alias + passphrase
   * No email, no server — pure cryptographic identity
   */
  async create(alias: string, passphrase: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.user.create(alias, passphrase, (ack: any) => {
        if (ack.err) reject(new Error(ack.err));
        else resolve(true);
      });
    });
  }

  async login(alias: string, passphrase: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.user.auth(alias, passphrase, (ack: any) => {
        if (ack.err) reject(new Error(ack.err));
        else resolve(ack);
      });
    });
  }

  logout(): void {
    this.user.leave();
  }

  get pub(): string | undefined {
    return this.user?.is?.pub;
  }

  get isAuthenticated(): boolean {
    return !!this.user?.is?.pub;
  }
}
