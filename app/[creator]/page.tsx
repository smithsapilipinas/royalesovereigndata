'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { RoyaleDB } from '@/lib/gun';

interface CreatorProfile {
  name: string;
  bio: string;
  walletAddress: string;
  avatar?: string;
  tier: 'citizen' | 'ambassador' | 'royalty';
  nations: number;
  totalContent: number;
  totalRevenue: number;
  joinedAt: number;
  tags: string[];
  socials?: {
    twitter?: string;
    instagram?: string;
    website?: string;
  };
}

interface ContentItem {
  id: string;
  title: string;
  description: string;
  contentType: string;
  ipfsCid: string;
  gatewayUrl: string;
  priceMicro: number;
  currency: string;
  plays: number;
  downloads: number;
  createdAt: number;
  tags: string[];
}

const TIER_LABELS = {
  citizen:    { label: 'CITIZEN',    color: '#6B7280' },
  ambassador: { label: 'AMBASSADOR', color: '#00FFFF' },
  royalty:    { label: 'ROYALTY',    color: '#FFD700' },
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
  audio:    '◎',
  video:    '▶',
  document: '◈',
  image:    '◉',
  other:    '◆',
};

export default function CreatorPage() {
  const params = useParams();
  const creatorSlug = params?.creator as string;

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [content, setContent]  = useState<ContentItem[]>([]);
  const [loading, setLoading]  = useState(true);
  const [filter, setFilter]    = useState<string>('all');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!creatorSlug) return;

    const db = new RoyaleDB();

    // Load creator profile from Gun.js
    db.getUser(creatorSlug).then((userData) => {
      if (!userData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(userData as CreatorProfile);
    });

    // Subscribe to creator's content in real-time
    const unsub = db.onContentList((items) => {
      const creatorItems = items.filter(
        (item: ContentItem) => item.id?.startsWith(creatorSlug) ||
        (profile?.walletAddress && item.id?.includes(profile.walletAddress.slice(-8)))
      );
      setContent(creatorItems);
      setLoading(false);
    });

    return unsub;
  }, [creatorSlug]);

  const filteredContent = filter === 'all'
    ? content
    : content.filter(c => c.contentType === filter);

  const contentTypes = ['all', ...Array.from(new Set(content.map(c => c.contentType)))];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080B0F] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#FFD700] text-4xl animate-pulse mb-4">◈</div>
          <p className="text-[#6B7280] font-mono text-sm">Retrieving sovereign data...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#080B0F] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-[#6B7280] text-6xl mb-4">◇</div>
          <h1 className="text-white text-2xl font-bold mb-2">Creator Not Found</h1>
          <p className="text-[#6B7280] text-sm">
            <span className="text-[#FFD700] font-mono">@{creatorSlug}</span> hasn't joined the Ark yet.
          </p>
          <a
            href="/"
            className="mt-6 inline-block px-6 py-2 border border-[rgba(255,215,0,0.25)] text-[#FFD700] text-sm font-mono rounded-lg hover:bg-[rgba(255,215,0,0.05)] transition-colors"
          >
            Enter Royale
          </a>
        </div>
      </div>
    );
  }

  const tier = profile?.tier ? TIER_LABELS[profile.tier] : TIER_LABELS.citizen;

  return (
    <div className="min-h-screen bg-[#080B0F] text-[#E8EAF0]">
      {/* Holographic grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-10 flex items-start gap-6">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{
              background: 'rgba(255,215,0,0.06)',
              border: '1px solid rgba(255,215,0,0.2)',
            }}
          >
            {profile?.avatar ? (
              <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              '◈'
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-white truncate">{profile?.name || creatorSlug}</h1>
              <span
                className="px-2 py-0.5 rounded text-xs font-mono font-bold"
                style={{ color: tier.color, border: `1px solid ${tier.color}30`, background: `${tier.color}0A` }}
              >
                {tier.label}
              </span>
            </div>

            <p className="text-[#6B7280] text-sm font-mono mb-3">
              @{creatorSlug}
            </p>

            {profile?.bio && (
              <p className="text-[#9CA3AF] text-sm leading-relaxed max-w-xl mb-4">{profile.bio}</p>
            )}

            {/* Stats */}
            <div className="flex gap-6 flex-wrap">
              {[
                { label: 'CONTENT', value: content.length },
                { label: 'NATIONS', value: profile?.nations || '—' },
                { label: 'REVENUE', value: profile?.totalRevenue ? `${profile.totalRevenue.toFixed(2)} ALGO` : '—' },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-lg font-bold text-[#FFD700]">{s.value}</div>
                  <div className="text-[0.65rem] text-[#6B7280] font-mono tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          {profile?.tags?.length ? (
            <div className="hidden md:flex flex-wrap gap-2 max-w-xs">
              {profile.tags.slice(0, 5).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-xs font-mono"
                  style={{ background: 'rgba(0,255,255,0.06)', color: '#00FFFF', border: '1px solid rgba(0,255,255,0.15)' }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Content Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {contentTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
              style={{
                background: filter === type ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)',
                border: filter === type ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.06)',
                color: filter === type ? '#FFD700' : '#6B7280',
              }}
            >
              {type === 'all' ? 'ALL' : type.toUpperCase()}
              {type !== 'all' && (
                <span className="ml-1.5 opacity-60">
                  {content.filter(c => c.contentType === type).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Grid */}
        {filteredContent.length === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-[#6B7280] text-4xl mb-3">◇</div>
            <p className="text-[#6B7280] text-sm font-mono">No content in the Ark yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContent.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContentCard({ item }: { item: ContentItem }) {
  const icon = CONTENT_TYPE_ICONS[item.contentType] || CONTENT_TYPE_ICONS.other;
  const priceAlgo = item.priceMicro ? (item.priceMicro / 1_000_000).toFixed(2) : null;

  return (
    <div
      className="rounded-xl p-4 transition-all hover:-translate-y-0.5 cursor-pointer group"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Thumbnail / Icon area */}
      <div
        className="w-full aspect-video rounded-lg mb-3 flex items-center justify-center text-4xl"
        style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)' }}
      >
        {item.gatewayUrl && item.contentType === 'image' ? (
          <img src={item.gatewayUrl} alt={item.title} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <span className="text-[#FFD700] opacity-60 group-hover:opacity-100 transition-opacity">{icon}</span>
        )}
      </div>

      {/* Meta */}
      <h3 className="font-semibold text-sm text-white truncate mb-1">{item.title}</h3>
      <p className="text-[#6B7280] text-xs line-clamp-2 mb-3">{item.description}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-[0.65rem] text-[#6B7280] font-mono">
          <span>▶ {item.plays || 0}</span>
          <span>↓ {item.downloads || 0}</span>
        </div>
        {priceAlgo ? (
          <span className="text-[#FFD700] text-xs font-mono font-semibold">{priceAlgo} ALGO</span>
        ) : (
          <span className="text-[#00FFFF] text-xs font-mono">FREE</span>
        )}
      </div>
    </div>
  );
}
