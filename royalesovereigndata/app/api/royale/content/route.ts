import { NextRequest, NextResponse } from 'next/server';
import { RoyaleDB } from '@/lib/gun';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id       = searchParams.get('id');
    const creator  = searchParams.get('creator');
    const tag      = searchParams.get('tag');
    const limit    = parseInt(searchParams.get('limit') || '20', 10);

    const db = new RoyaleDB();

    // Fetch single content item by ID
    if (id) {
      const item = await db.getContent(id);
      if (!item) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, content: item });
    }

    // Search by tag
    if (tag) {
      const results = await db.searchByTag(tag);
      return NextResponse.json({ success: true, content: results.slice(0, limit) });
    }

    // Return all (paginated) — Gun.js streams so we timeout after 2s
    return new Promise<NextResponse>((resolve) => {
      const items: unknown[] = [];
      const timeout = setTimeout(() => {
        resolve(NextResponse.json({ success: true, content: items.slice(0, limit) }));
      }, 2000);

      db.onContentList((all: unknown[]) => {
        clearTimeout(timeout);
        const filtered = creator
          ? (all as { creator?: string }[]).filter(c => c.creator === creator)
          : all;
        resolve(NextResponse.json({ success: true, content: (filtered as unknown[]).slice(0, limit) }));
      });
    });

  } catch (err) {
    console.error('[content/GET]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve content', details: String(err) },
      { status: 500 }
    );
  }
}
