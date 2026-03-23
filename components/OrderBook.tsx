'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useOrderbookWs } from '@/hooks/use-orderbook-ws';
import { fetchMarketTrades, toDisplayPrice, toDisplayQty } from '@/lib/api/backend';
import type { BackendOrder, BackendTrade } from '@/lib/api/backend';
import type { WsStatus } from '@/hooks/use-orderbook-ws';

// ─── Types ─────────────────────────────────────────────────────────────────────

type OutcomeToken = 'yes' | 'no';

interface OrderBookProps {
  marketId: string;
  /** 0–1 decimal price for YES (used for mid-price display when WS data is empty) */
  yesPrice: number;
  /** 0–1 decimal price for NO */
  noPrice: number;
  selectedTokenType?: OutcomeToken;
  /** Wallet pubkey of the connected user — highlights their orders with "YOU" */
  userPubkey?: string;
}

interface PriceLevel {
  /** Backend basis-point price (0–100) */
  price: number;
  size: number;
  total: number;
  isUser: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Aggregate individual BackendOrder[] into price levels.
 *  Normalises micro-unit prices → display % (÷10_000)
 *  and base-unit quantities → shares (÷1_000_000). */
function aggregateLevels(orders: BackendOrder[], userPubkey?: string): PriceLevel[] {
  const map = new Map<number, { size: number; isUser: boolean }>();
  for (const order of orders) {
    const displayPrice = toDisplayPrice(order.price);
    const displaySize  = toDisplayQty(order.remaining_quantity);
    const isMine = !!userPubkey && order.user_pubkey === userPubkey;
    const entry = map.get(displayPrice);
    if (entry) {
      entry.size += displaySize;
      if (isMine) entry.isUser = true;
    } else {
      map.set(displayPrice, { size: displaySize, isUser: isMine });
    }
  }
  return [...map.entries()].map(([price, d]) => ({ price, ...d, total: 0 }));
}

function withCumulativeTotals(levels: PriceLevel[]): PriceLevel[] {
  let cum = 0;
  return levels.map((l) => {
    cum += l.size;
    return { ...l, total: cum };
  });
}

function formatSize(size: number): string {
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)}M`;
  if (size >= 1_000) return `${(size / 1_000).toFixed(1)}K`;
  if (size < 1 && size > 0) return size.toFixed(4);
  return size % 1 === 0 ? String(size) : size.toFixed(2);
}

// ─── Status dot ────────────────────────────────────────────────────────────────

const StatusDot = ({ status }: { status: WsStatus }) => {
  const dotClass =
    status === 'connected'
      ? 'bg-emerald-500 animate-pulse'
      : status === 'connecting' || status === 'reconnecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-red-500';
  const label =
    status === 'connected'
      ? 'Live'
      : status === 'connecting'
        ? 'Connecting…'
        : status === 'reconnecting'
          ? 'Reconnecting…'
          : 'Disconnected';
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', dotClass)} />
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
    </span>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────

export const OrderBook = ({
  marketId,
  yesPrice,
  noPrice,
  selectedTokenType = 'yes',
  userPubkey,
}: OrderBookProps) => {
  const numericId = parseInt(marketId, 10);
  const validId = isNaN(numericId) ? null : numericId;

  const { orderbook, status } = useOrderbookWs(validId);

  // ── Derive aggregated bids/asks from live orderbook ─────────────────────────
  const { asks, bids } = useMemo(() => {
    if (!orderbook) return { asks: [] as PriceLevel[], bids: [] as PriceLevel[] };

    const rawBids = selectedTokenType === 'yes' ? orderbook.yes_bids : orderbook.no_bids;
    const rawAsks = selectedTokenType === 'yes' ? orderbook.yes_asks : orderbook.no_asks;

    const bidLevels = aggregateLevels(rawBids, userPubkey);
    bidLevels.sort((a, b) => b.price - a.price); // DESC
    const askLevels = aggregateLevels(rawAsks, userPubkey);
    askLevels.sort((a, b) => a.price - b.price); // ASC

    return {
      bids: withCumulativeTotals(bidLevels),
      asks: withCumulativeTotals(askLevels),
    };
  }, [orderbook, selectedTokenType, userPubkey]);

  // ── Mid price — prefer live best bid/ask, fall back to prop ─────────────────
  const midPrice = useMemo(() => {
    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;
    if (bestBid !== null && bestAsk !== null) return (bestBid + bestAsk) / 2;
    if (bestBid !== null) return bestBid;
    if (bestAsk !== null) return bestAsk;
    // Fallback to props (0–1 → convert to 0–100)
    return selectedTokenType === 'yes' ? yesPrice * 100 : noPrice * 100;
  }, [bids, asks, selectedTokenType, yesPrice, noPrice]);

  const spread = useMemo(() => {
    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;
    if (bestBid !== null && bestAsk !== null) return bestAsk - bestBid;
    return null;
  }, [bids, asks]);

  const maxTotal = Math.max(...asks.map((a) => a.total), ...bids.map((b) => b.total), 1);

  // ── Recent trades ───────────────────────────────────────────────────────────
  const [trades, setTrades] = useState<BackendTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  const loadTrades = useCallback(async () => {
    if (!validId) return;
    setTradesLoading(true);
    try {
      const t = await fetchMarketTrades(validId, 20);
      setTrades(t);
    } catch {
      // Silently ignore — trades are supplemental
    } finally {
      setTradesLoading(false);
    }
  }, [validId]);

  useEffect(() => {
    loadTrades();
    const interval = setInterval(loadTrades, 10_000);
    return () => clearInterval(interval);
  }, [loadTrades]);

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'book' | 'trades'>('book');

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  return (
    <div className="panel-card overflow-hidden">
      {/* ── Header ── */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {selectedTokenType.toUpperCase()} Order Book
          </h3>
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
          <StatusDot status={status} />
          {orderbook && (
            <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
              slot {orderbook.slot.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-border/20 dark:border-border/10 bg-muted/5">
        {(['book', 'trades'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2 text-[11px] font-medium transition-colors capitalize',
              activeTab === tab
                ? 'text-foreground border-b-2 border-foreground/60 -mb-px'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'book' ? 'Order Book' : 'Recent Trades'}
          </button>
        ))}
      </div>

      {/* ── Connecting skeleton ── */}
      {!orderbook && (status === 'connecting' || status === 'reconnecting') && (
        <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
          <div className="h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <p className="text-[11px] text-muted-foreground">
            {status === 'connecting' ? 'Connecting to live orderbook…' : 'Reconnecting…'}
          </p>
        </div>
      )}

      {/* ── Disconnected state ── */}
      {!orderbook && status === 'disconnected' && (
        <div className="px-5 py-8 text-center">
          <p className="text-[11px] text-muted-foreground">
            Unable to connect to backend. Make sure the server is running at{' '}
            <span className="font-mono text-foreground/60">
              {process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3003'}
            </span>
          </p>
        </div>
      )}

      {/* ── Order Book tab ── */}
      {orderbook && activeTab === 'book' && (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-3 px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20 dark:border-border/10 bg-muted/10 dark:bg-muted/5">
            <span>Price (¢)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          {/* Asks — displayed highest→lowest so best ask is nearest the mid */}
          <div className="relative">
            {asks.length === 0 && (
              <div className="px-5 py-3 text-[11px] text-muted-foreground/50 text-center">
                No asks
              </div>
            )}
            {asks
              .slice()
              .reverse()
              .map((ask, idx) => {
                const depthPct = (ask.total / maxTotal) * 100;
                const key = `ask-${idx}`;
                const hovered = hoveredRow === key;
                return (
                  <div
                    key={key}
                    onMouseEnter={() => setHoveredRow(key)}
                    onMouseLeave={() => setHoveredRow(null)}
                    className={cn(
                      'relative grid grid-cols-3 px-5 py-2 text-xs transition-all duration-100 cursor-pointer',
                      hovered && 'bg-red-500/5',
                      ask.isUser && 'ring-1 ring-inset ring-amber-400/30 bg-amber-500/4',
                    )}
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-500/6 transition-all duration-300"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="relative z-10 flex items-center gap-1.5 font-mono text-red-400 font-medium">
                      {ask.price.toFixed(1)}
                      {ask.isUser && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400/20 text-amber-400 font-bold tracking-wide">
                          YOU
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'relative z-10 text-right font-mono transition-colors',
                        hovered ? 'text-foreground' : 'text-muted-foreground',
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

          {/* Mid price & spread */}
          <div className="px-5 py-3 bg-muted/15 dark:bg-muted/5 border-y border-border/20 dark:border-border/10">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-foreground font-mono">
                  {midPrice.toFixed(2)}¢
                </span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Mid
                </span>
              </div>
              {spread !== null && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Spread
                  </span>
                  <span className="text-xs font-mono font-medium text-foreground">
                    {spread.toFixed(1)}¢
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bids */}
          <div className="relative">
            {bids.length === 0 && (
              <div className="px-5 py-3 text-[11px] text-muted-foreground/50 text-center">
                No bids
              </div>
            )}
            {bids.map((bid, idx) => {
              const depthPct = (bid.total / maxTotal) * 100;
              const key = `bid-${idx}`;
              const hovered = hoveredRow === key;
              return (
                <div
                  key={key}
                  onMouseEnter={() => setHoveredRow(key)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={cn(
                    'relative grid grid-cols-3 px-5 py-2 text-xs transition-all duration-100 cursor-pointer',
                    hovered && 'bg-emerald-500/5',
                    bid.isUser && 'ring-1 ring-inset ring-amber-400/30 bg-amber-500/4',
                  )}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/6 transition-all duration-300"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative z-10 flex items-center gap-1.5 font-mono text-emerald-400 font-medium">
                    {bid.price.toFixed(1)}
                    {bid.isUser && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-400/20 text-amber-400 font-bold tracking-wide">
                        YOU
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'relative z-10 text-right font-mono transition-colors',
                      hovered ? 'text-foreground' : 'text-muted-foreground',
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

          {/* Footer note */}
          <div className="px-5 py-3 border-t border-border/20 bg-amber-500/5 dark:bg-amber-500/3">
            <div className="flex gap-2 items-start">
              <div className="text-amber-600 dark:text-amber-400/80 mt-0.5 shrink-0">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/70 leading-relaxed">
                <span className="font-semibold">Note:</span> Your buy and sell orders for the same
                outcome won&apos;t match each other. Orders only match with other traders.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Recent Trades tab ── */}
      {activeTab === 'trades' && (
        <>
          <div className="grid grid-cols-4 px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20 dark:border-border/10 bg-muted/10 dark:bg-muted/5">
            <span>Side</span>
            <span>Token</span>
            <span className="text-right">Price</span>
            <span className="text-right">Qty</span>
          </div>

          {tradesLoading && trades.length === 0 && (
            <div className="px-5 py-8 flex justify-center">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
            </div>
          )}

          {!tradesLoading && trades.length === 0 && (
            <div className="px-5 py-8 text-center text-[11px] text-muted-foreground/50">
              No trades yet
            </div>
          )}

          <div className="max-h-72 overflow-y-auto">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="grid grid-cols-4 px-5 py-2 text-xs border-b border-border/10 last:border-0 hover:bg-muted/10 transition-colors"
              >
                <span
                  className={cn(
                    'font-medium font-mono',
                    trade.taker_side === 'Buy' ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {trade.taker_side}
                </span>
                <span
                  className={cn(
                    'font-mono text-[11px]',
                    trade.token_type === 'Yes' ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {trade.token_type}
                </span>
                <span className="text-right font-mono text-foreground/80">
                  {toDisplayPrice(trade.price).toFixed(1)}¢
                </span>
                <span className="text-right font-mono text-muted-foreground">
                  {formatSize(toDisplayQty(trade.quantity))}
                </span>
              </div>
            ))}
          </div>

          {trades.length > 0 && (
            <div className="px-5 py-2 border-t border-border/10 bg-muted/5">
              <p className="text-[10px] text-muted-foreground/50">
                Showing {trades.length} most recent trades · auto-refreshes every 10s
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
