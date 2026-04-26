'use client';

import { useEffect, useState, useRef } from 'react';
import { Flame, Zap } from 'lucide-react';
import { MarketCard } from '@/components/MarketCard';
import { MarketCardSkeleton } from '@/components/MarketCardSkeleton';
import { getHotMarketsAction, type HotMarketEntry } from '@/app/markets/actions';

// Poll interval matches the server-side cache TTL so we never wake up to stale data
const REFRESH_MS = 10 * 60 * 1000;

export function HotMarkets() {
  const [entries, setEntries] = useState<HotMarketEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHot = async () => {
    const res = await getHotMarketsAction();
    if (res.success && res.entries) setEntries(res.entries);
    setLoading(false);
  };

  useEffect(() => {
    void fetchHot();
    timerRef.current = setInterval(() => void fetchHot(), REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (!loading && entries.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
          <Flame className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
            Hot Right Now
          </span>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block">
          Highest volume markets
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <>
            <MarketCardSkeleton />
            <MarketCardSkeleton />
            <MarketCardSkeleton />
          </>
        ) : entries.length > 0 ? (
          entries.map((entry) => (
            <MarketCard key={entry.market.marketId} market={entry.market} />
          ))
        ) : (
          <div className="col-span-3 flex items-center justify-center py-8 rounded-xl border border-dashed border-border/40 text-sm text-muted-foreground gap-2">
            <Zap className="h-4 w-4" />
            No markets yet
          </div>
        )}
      </div>
    </section>
  );
}
