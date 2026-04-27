import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { fetchAllDisplayMarketsFromBackend } from '@/lib/blockchain/markets';

// 60s server-side cache — warm enough that metadata re-fetches are rare.
// stale-while-revalidate lets Next.js serve stale data while refreshing in background.
const getCachedMarkets = unstable_cache(
  () => fetchAllDisplayMarketsFromBackend(),
  ['api-all-markets'],
  { revalidate: 60 },
);

export async function GET() {
  try {
    const markets = await getCachedMarkets();
    return NextResponse.json(
      { markets },
      {
        headers: {
          // Browser/CDN: serve fresh for 60s, then revalidate in background for up to 2 min
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (err) {
    console.error('[/api/markets] fetch failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 },
    );
  }
}
