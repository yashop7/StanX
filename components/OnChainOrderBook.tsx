'use client';

/**
 * OnChainOrderBook — polls the Solana on-chain orderbook PDA every 30s.
 * Used for comparison against the backend WebSocket orderbook.
 */

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { fetchOnChainOrderBook } from '@/lib/blockchain/orderbook';
import type { ChainLevel, OutcomeToken } from '@/lib/blockchain/orderbook';

const REFRESH_INTERVAL = 30;
const INITIAL_DELAY_MS = 20_000; // wait 20s after page load before first RPC fetch

interface OnChainOrderBookProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  selectedTokenType?: OutcomeToken;
  userPubkey?: string;
}

const formatSize = (size: number) => {
  if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
  if (size < 1 && size > 0) return size.toFixed(3);
  return size % 1 === 0 ? String(size) : size.toFixed(2);
};

export const OnChainOrderBook = ({
  marketId,
  yesPrice,
  noPrice,
  selectedTokenType = 'yes',
  userPubkey,
}: OnChainOrderBookProps) => {
  const [asks, setAsks] = useState<ChainLevel[]>([]);
  const [bids, setBids] = useState<ChainLevel[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(INITIAL_DELAY_MS / 1000);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const selectedPrice = selectedTokenType === 'yes' ? yesPrice : noPrice;
  const impliedCounterPrice = 1 - selectedPrice;
  const midPrice = (selectedPrice + impliedCounterPrice) / 2;
  const spread = Math.abs(selectedPrice - impliedCounterPrice);
  const spreadPercent = ((spread / midPrice) * 100).toFixed(2);

  const buildAndSet = useCallback(async () => {
    const numericMarketId = parseInt(marketId, 10);
    if (isNaN(numericMarketId)) return;
    setFetchError(null);
    try {
      const chainBook = await fetchOnChainOrderBook(numericMarketId, selectedTokenType, userPubkey);

      const askMap = new Map<number, { size: number; isUser: boolean }>();
      const bidMap = new Map<number, { size: number; isUser: boolean }>();

      if (chainBook) {
        chainBook.asks.forEach((l) => askMap.set(l.price, { size: l.size, isUser: l.isUser }));
        chainBook.bids.forEach((l) => bidMap.set(l.price, { size: l.size, isUser: l.isUser }));
      }

      const finalAsks = [...askMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([price, d]) => ({ price, ...d, total: 0 }));
      let cumAsk = 0;
      finalAsks.forEach((l) => {
        cumAsk += l.size;
        l.total = cumAsk;
      });

      const finalBids = [...bidMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([price, d]) => ({ price, ...d, total: 0 }));
      let cumBid = 0;
      finalBids.forEach((l) => {
        cumBid += l.size;
        l.total = cumBid;
      });

      setAsks(finalAsks);
      setBids(finalBids);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch');
      console.error('[OnChainOrderBook] fetch failed:', err);
    }
    setLastRefreshed(new Date());
    setCountdown(REFRESH_INTERVAL);
  }, [marketId, selectedTokenType, userPubkey]);

  const handleRefresh = useCallback(
    (animate = true) => {
      if (animate) setIsRefreshing(true);
      buildAndSet().finally(() => {
        if (animate) setIsRefreshing(false);
      });
    },
    [buildAndSet],
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timer = setTimeout(() => {
      buildAndSet();
      interval = setInterval(() => buildAndSet(), REFRESH_INTERVAL * 1000);
    }, INITIAL_DELAY_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildAndSet]);

  useEffect(() => {
    const timer = setInterval(
      () => setCountdown((prev) => (prev > 0 ? prev - 1 : 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, [lastRefreshed]);

  const maxTotal = Math.max(...asks.map((a) => a.total), ...bids.map((b) => b.total), 1);
  const timeAgo = Math.round((Date.now() - lastRefreshed.getTime()) / 1000);

  return (
    <div className="panel-card overflow-hidden border-2 border-violet-500/30">
      {/* Header */}
      <div className="panel-header flex items-center justify-between bg-violet-500/5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">On-Chain Order Book</h3>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-violet-500/15 text-violet-400 uppercase tracking-wider">
            RPC Poll
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded',
              selectedTokenType === 'yes'
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger',
            )}
          >
            {selectedTokenType.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            {countdown}s
          </span>
          <button
            onClick={() => handleRefresh(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 border border-border/20 hover:border-border/50 transition-all duration-200"
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-[10px] text-red-400 font-mono">
          RPC error: {fetchError}
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-3 px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20 dark:border-border/10 bg-muted/10">
        <span>Price (0–1)</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks */}
      <div className="relative">
        {asks.length === 0 && !fetchError && (
          <div className="px-4 py-3 text-[11px] text-muted-foreground/50 text-center">No asks</div>
        )}
        {asks
          .slice()
          .reverse()
          .map((ask, idx) => {
            const depthPct = (ask.total / maxTotal) * 100;
            const key = `ask-${idx}`;
            return (
              <div
                key={key}
                onMouseEnter={() => setHoveredRow(key)}
                onMouseLeave={() => setHoveredRow(null)}
                className={cn(
                  'relative grid grid-cols-3 px-4 py-1.5 text-xs transition-all cursor-pointer',
                  hoveredRow === key && 'bg-red-500/5',
                  ask.isUser && 'ring-1 ring-inset ring-amber-400/30 bg-amber-500/4',
                )}
              >
                <div
                  className="absolute right-0 top-0 bottom-0 bg-red-500/6"
                  style={{ width: `${depthPct}%` }}
                />
                <span className="relative z-10 flex items-center gap-1.5 font-mono text-red-400 font-medium">
                  {(ask.price * 100).toFixed(1)}¢
                  {ask.isUser && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400/20 text-amber-400 font-bold">
                      YOU
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'relative z-10 text-right font-mono',
                    hoveredRow === key ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {formatSize(ask.size)}
                </span>
                <span className="relative z-10 text-right font-mono text-muted-foreground/60">
                  {formatSize(ask.total)}
                </span>
              </div>
            );
          })}
      </div>

      {/* Mid price */}
      <div className="px-4 py-2.5 bg-muted/15 border-y border-border/20">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold font-mono text-foreground">
              {(midPrice * 100).toFixed(2)}¢
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Mid</span>
          </div>
          <span className="text-xs font-mono text-foreground/70">Spread {spreadPercent}%</span>
        </div>
      </div>

      {/* Bids */}
      <div className="relative">
        {bids.length === 0 && !fetchError && (
          <div className="px-4 py-3 text-[11px] text-muted-foreground/50 text-center">No bids</div>
        )}
        {bids.map((bid, idx) => {
          const depthPct = (bid.total / maxTotal) * 100;
          const key = `bid-${idx}`;
          return (
            <div
              key={key}
              onMouseEnter={() => setHoveredRow(key)}
              onMouseLeave={() => setHoveredRow(null)}
              className={cn(
                'relative grid grid-cols-3 px-4 py-1.5 text-xs transition-all cursor-pointer',
                hoveredRow === key && 'bg-emerald-500/5',
                bid.isUser && 'ring-1 ring-inset ring-amber-400/30 bg-amber-500/4',
              )}
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-emerald-500/6"
                style={{ width: `${depthPct}%` }}
              />
              <span className="relative z-10 flex items-center gap-1.5 font-mono text-emerald-400 font-medium">
                {(bid.price * 100).toFixed(1)}¢
                {bid.isUser && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400/20 text-amber-400 font-bold">
                    YOU
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'relative z-10 text-right font-mono',
                  hoveredRow === key ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {formatSize(bid.size)}
              </span>
              <span className="relative z-10 text-right font-mono text-muted-foreground/60">
                {formatSize(bid.total)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/10 flex items-center justify-between bg-muted/5">
        <span className="text-[10px] text-muted-foreground/50 tabular-nums">
          Updated {timeAgo < 5 ? 'just now' : `${timeAgo}s ago`}
        </span>
        <span className="text-[10px] text-violet-400/60 font-mono">Solana RPC</span>
      </div>
    </div>
  );
};
