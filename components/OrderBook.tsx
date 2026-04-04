'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useOrderbookWs } from '@/hooks/use-orderbook-ws';
import { toDisplayPrice, toDisplayQty } from '@/lib/api/backend';
import type { BackendOrder } from '@/lib/api/backend';
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
        : 'bg-red-500/70';
  const label =
    status === 'connected'
      ? 'Live'
      : status === 'connecting'
        ? 'Connecting…'
        : status === 'reconnecting'
          ? 'Reconnecting…'
          : 'Offline';
  return (
    <span className="flex items-center gap-1">
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', dotClass)} />
      <span className="text-[10px] font-mono font-medium text-muted-foreground/50">{label}</span>
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

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  return (
    <div className="overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/10 dark:border-border/[0.08]">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
            Order Book
          </h3>
          <span
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm',
              selectedTokenType === 'yes'
                ? 'bg-emerald-500/12 text-emerald-400/80'
                : 'bg-red-500/12 text-red-400/80',
            )}
          >
            {selectedTokenType.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          {orderbook && (
            <span className="text-[10px] font-mono text-muted-foreground/25 tabular-nums">
              slot {orderbook.slot.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* ── Connecting skeleton ── */}
      {!orderbook && (status === 'connecting' || status === 'reconnecting') && (
        <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
          <div className="h-4 w-4 rounded-full border-2 border-amber-400/60 border-t-transparent animate-spin" />
          <p className="text-[10px] font-mono text-muted-foreground/30 tracking-widest uppercase">
            {status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          </p>
        </div>
      )}

      {/* ── Disconnected ── */}
      {!orderbook && status === 'disconnected' && (
        <div className="px-4 py-10 text-center">
          <p className="text-[11px] text-muted-foreground/40">
            No connection to backend.
          </p>
        </div>
      )}

      {/* ════════════════════ ORDER BOOK ════════════════════ */}
      {orderbook && (
        <div className="mt-3">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2 border-b border-border/[0.08] text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
            <span>Price (¢)</span>
            <span className="text-right w-20 pr-3">Size</span>
            <span className="text-right w-16">Total</span>
          </div>

          {/* ── Asks (reversed so best ask is closest to mid) ── */}
          <div>
            {asks.length === 0 && (
              <div className="px-4 py-3 text-[10px] font-mono text-muted-foreground/25 text-center">
                No asks
              </div>
            )}
            {asks
              .slice()
              .reverse()
              .map((ask, idx) => {
                const depthPct = (ask.total / maxTotal) * 60;
                const key = `ask-${idx}`;
                return (
                  <div
                    key={key}
                    onMouseEnter={() => setHoveredRow(key)}
                    onMouseLeave={() => setHoveredRow(null)}
                    className="relative grid grid-cols-[1fr_auto_auto] items-center px-4 py-1.5 transition-colors group cursor-pointer"
                  >
                    {/* Always-on subtle depth wash */}
                    <div
                      className="absolute right-0 inset-y-0 pointer-events-none bg-red-500/[0.04]"
                      style={{ width: `${depthPct * 0.6}%` }}
                    />
                    {/* Hover depth wash */}
                    <div
                      className="absolute right-0 inset-y-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/[0.07]"
                      style={{ width: `${depthPct}%` }}
                    />
                    {/* Left accent bar */}
                    <div className="absolute left-0 top-[18%] bottom-[18%] w-0.5 rounded-r-full bg-red-500/50" />

                    <span className="relative z-10 flex items-center gap-1.5 font-mono text-red-400 font-semibold text-sm tabular-nums">
                      {ask.price.toFixed(1)}
                      <span className="text-[10px] font-normal opacity-40">¢</span>
                      {ask.isUser && (
                        <span className="text-[9px] px-1 py-px rounded bg-amber-400/20 text-amber-400 font-bold tracking-wide leading-none">
                          YOU
                        </span>
                      )}
                    </span>
                    <span className="relative z-10 text-right w-20 pr-3 font-mono text-xs text-muted-foreground/60 tabular-nums">
                      {formatSize(ask.size)}
                    </span>
                    <span className="relative z-10 text-right w-16 font-mono text-[10px] text-muted-foreground/30 tabular-nums">
                      {formatSize(ask.total)}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* ── Mid price & spread ── */}
          <div className="px-4 py-1.5 border-y border-border/[0.08] bg-muted/[0.04]">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold font-mono tabular-nums tracking-tight">
                  {midPrice.toFixed(2)}
                  <span className="text-xs font-normal opacity-40 ml-0.5">¢</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  Mid
                </span>
              </div>
              {spread !== null && (
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                    Spread
                  </span>
                  <span className="font-mono text-xs font-semibold text-muted-foreground/60 tabular-nums">
                    {spread.toFixed(1)}¢
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Bids ── */}
          <div>
            {bids.length === 0 && (
              <div className="px-4 py-3 text-[10px] font-mono text-muted-foreground/25 text-center">
                No bids
              </div>
            )}
            {bids.map((bid, idx) => {
              const depthPct = (bid.total / maxTotal) * 60;
              const key = `bid-${idx}`;
              return (
                <div
                  key={key}
                  onMouseEnter={() => setHoveredRow(key)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className="relative grid grid-cols-[1fr_auto_auto] items-center px-4 py-1.5 transition-colors group cursor-pointer"
                >
                  <div
                    className="absolute right-0 inset-y-0 pointer-events-none bg-emerald-500/[0.04]"
                    style={{ width: `${depthPct * 0.6}%` }}
                  />
                  <div
                    className="absolute right-0 inset-y-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-500/[0.07]"
                    style={{ width: `${depthPct}%` }}
                  />
                  <div className="absolute left-0 top-[18%] bottom-[18%] w-0.5 rounded-r-full bg-emerald-500/50" />

                  <span className="relative z-10 flex items-center gap-1.5 font-mono text-emerald-400 font-semibold text-sm tabular-nums">
                    {bid.price.toFixed(1)}
                    <span className="text-[10px] font-normal opacity-40">¢</span>
                    {bid.isUser && (
                      <span className="text-[9px] px-1 py-px rounded bg-amber-400/20 text-amber-400 font-bold tracking-wide leading-none">
                        YOU
                      </span>
                    )}
                  </span>
                  <span className="relative z-10 text-right w-20 pr-3 font-mono text-xs text-muted-foreground/60 tabular-nums">
                    {formatSize(bid.size)}
                  </span>
                  <span className="relative z-10 text-right w-16 font-mono text-[10px] text-muted-foreground/30 tabular-nums">
                    {formatSize(bid.total)}
                  </span>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
};
