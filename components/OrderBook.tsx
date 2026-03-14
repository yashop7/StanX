'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { fetchOnChainOrderBook } from '@/lib/blockchain/orderbook';
import type { ChainLevel, OutcomeToken } from '@/lib/blockchain/orderbook';

const REFRESH_INTERVAL = 30; // seconds

interface OrderBookProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  selectedTokenType?: OutcomeToken;
}

type DisplayLevel = ChainLevel;

export const OrderBook = ({ marketId, yesPrice, noPrice, selectedTokenType = 'yes' }: OrderBookProps) => {

  const [asks, setAsks] = useState<DisplayLevel[]>([]);
  const [bids, setBids] = useState<DisplayLevel[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const selectedPrice = selectedTokenType === 'yes' ? yesPrice : noPrice;
  const impliedCounterPrice = 1 - selectedPrice;
  const midPrice = (selectedPrice + impliedCounterPrice) / 2;
  const spread = Math.abs(selectedPrice - impliedCounterPrice);
  const spreadPercent = (spread / midPrice * 100).toFixed(2);

  /** Fetches the on-chain orderbook and merges into sorted bid/ask arrays. */
  const buildAndSet = useCallback(async () => {
    const numericMarketId = parseInt(marketId, 10);
    if (isNaN(numericMarketId)) return;

    setFetchError(null);

    try {
      const chainBook = await fetchOnChainOrderBook(numericMarketId, selectedTokenType);

      const askMap = new Map<number, { size: number; isUser: boolean }>();
      const bidMap = new Map<number, { size: number; isUser: boolean }>();

      if (chainBook) {
        chainBook.asks.forEach(l => askMap.set(l.price, { size: l.size, isUser: l.isUser }));
        chainBook.bids.forEach(l => bidMap.set(l.price, { size: l.size, isUser: l.isUser }));
      }

      // Build sorted arrays with cumulative totals
      const finalAsks = [...askMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([price, d]) => ({ price, ...d, total: 0 }));
      let cumAsk = 0;
      finalAsks.forEach(l => { cumAsk += l.size; l.total = cumAsk; });

      const finalBids = [...bidMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([price, d]) => ({ price, ...d, total: 0 }));
      let cumBid = 0;
      finalBids.forEach(l => { cumBid += l.size; l.total = cumBid; });

      setAsks(finalAsks);
      setBids(finalBids);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch order book';
      setFetchError(msg);
      console.error('[OrderBook] fetch failed:', err);
    }

    setLastRefreshed(new Date());
    setCountdown(REFRESH_INTERVAL);
  }, [marketId, selectedTokenType]);

  const handleRefresh = useCallback((animate = true) => {
    if (animate) setIsRefreshing(true);
    buildAndSet().finally(() => {
      if (animate) setIsRefreshing(false);
    });
  }, [buildAndSet]);

  // Initial build
  useEffect(() => {
    buildAndSet();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildAndSet]);

  // Auto-refresh every REFRESH_INTERVAL seconds
  useEffect(() => {
    const interval = setInterval(() => buildAndSet(), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildAndSet]);

  // Countdown ticker
  useEffect(() => {
    const timer = setInterval(() => setCountdown(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [lastRefreshed]);

  const maxTotal = Math.max(...asks.map(a => a.total), ...bids.map(b => b.total), 1);
  const formatSize = (size: number) => {
    if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
    if (size < 1 && size > 0) return size.toFixed(3);
    return size % 1 === 0 ? String(size) : size.toFixed(2);
  };
  const timeAgo = Math.round((Date.now() - lastRefreshed.getTime()) / 1000);

  return (
    <div className="panel-card overflow-hidden">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {selectedTokenType.toUpperCase()} Order Book
        </h3>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded',
              selectedTokenType === 'yes'
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger'
            )}
          >
            {selectedTokenType.toUpperCase()}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            Refresh in {countdown}s
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

      {/* Error banner */}
      {fetchError && (
        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-[10px] text-red-400 font-mono">
          RPC error: {fetchError}
        </div>
      )}

      {/* Table Header */}
      <div className="grid grid-cols-3 px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20 dark:border-border/10 bg-muted/10 dark:bg-muted/5">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (Sellers) - displayed highest→lowest so best ask is nearest the mid */}
      <div className="relative">
        {asks.slice().reverse().map((ask, idx) => {
          const depthPercent = (ask.total / maxTotal) * 100;
          const isHovered = hoveredRow === `ask-${idx}`;
          return (
            <div
              key={`ask-${idx}`}
              onMouseEnter={() => setHoveredRow(`ask-${idx}`)}
              onMouseLeave={() => setHoveredRow(null)}
              className={cn(
                'relative grid grid-cols-3 px-5 py-2 text-xs transition-all duration-100 cursor-pointer',
                isHovered && 'bg-red-500/5',
                ask.isUser && 'ring-1 ring-inset ring-amber-400/30 bg-amber-500/4'
              )}
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-red-500/6 transition-all duration-300"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="relative z-10 flex items-center gap-1.5 font-mono text-red-400 font-medium">
                {(ask.price * 100).toFixed(1)}¢
                {ask.isUser && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400/20 text-amber-400 font-bold tracking-wide">
                    YOU
                  </span>
                )}
              </span>
              <span className={cn('relative z-10 text-right font-mono transition-colors', isHovered ? 'text-foreground' : 'text-muted-foreground')}>
                {formatSize(ask.size)}
              </span>
              <span className="relative z-10 text-right font-mono text-muted-foreground/60">
                {formatSize(ask.total)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mid Price & Spread */}
      <div className="px-5 py-3 bg-muted/15 dark:bg-muted/5 border-y border-border/20 dark:border-border/10">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-foreground font-mono">
              {(midPrice * 100).toFixed(2)}¢
            </span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mid</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Spread</span>
            <span className="text-xs font-mono font-medium text-foreground">{spreadPercent}%</span>
          </div>
        </div>
      </div>

      {/* Bids (Buyers) */}
      <div className="relative">
        {bids.map((bid, idx) => {
          const depthPercent = (bid.total / maxTotal) * 100;
          const isHovered = hoveredRow === `bid-${idx}`;
          return (
            <div
              key={`bid-${idx}`}
              onMouseEnter={() => setHoveredRow(`bid-${idx}`)}
              onMouseLeave={() => setHoveredRow(null)}
              className={cn(
                'relative grid grid-cols-3 px-5 py-2 text-xs transition-all duration-100 cursor-pointer',
                isHovered && 'bg-emerald-500/5',
                bid.isUser && 'ring-1 ring-inset ring-amber-400/30 bg-amber-500/4'
              )}
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-emerald-500/6 transition-all duration-300"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="relative z-10 flex items-center gap-1.5 font-mono text-emerald-400 font-medium">
                {(bid.price * 100).toFixed(1)}¢
                {bid.isUser && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400/20 text-amber-400 font-bold tracking-wide">
                    YOU
                  </span>
                )}
              </span>
              <span className={cn('relative z-10 text-right font-mono transition-colors', isHovered ? 'text-foreground' : 'text-muted-foreground')}>
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
      <div className="px-5 py-2 border-t border-border/10 flex items-center justify-between bg-muted/5">
        <span className="text-[10px] text-muted-foreground/50 tabular-nums">
          Updated {timeAgo < 5 ? 'just now' : `${timeAgo}s ago`}
        </span>
        <span className="text-[10px] text-muted-foreground/50 tabular-nums">
          Auto-refresh in {countdown}s
        </span>
      </div>

      {/* Info Note */}
      <div className="px-5 py-3 border-t border-border/20 bg-amber-500/5 dark:bg-amber-500/3">
        <div className="flex gap-2 items-start">
          <div className="text-amber-600 dark:text-amber-400/80 mt-0.5 shrink-0">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-300/70 leading-relaxed">
            <span className="font-semibold">Note:</span> Your buy and sell orders for the same outcome won't match each other. Orders only match with other traders. Place both sides only if you intend to trade with different counterparties.
          </p>
        </div>
      </div>
    </div>
  );
};