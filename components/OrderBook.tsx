"use client";

import { useMemo } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrderbookWs } from "@/hooks/use-orderbook-ws";
import { toDisplayPrice, toDisplayQty } from "@/lib/api/backend";
import type { BackendOrder } from "@/lib/api/backend";
import type { WsStatus } from "@/hooks/use-orderbook-ws";

// ─── Types ─────────────────────────────────────────────────────────────────────

type OutcomeToken = "yes" | "no";

interface OrderBookProps {
  marketId: string;
  /** 0–1 decimal price for YES (used for mid-price display when WS data is empty) */
  yesPrice: number;
  /** 0–1 decimal price for NO */
  noPrice: number;
  selectedTokenType?: OutcomeToken;
  /** Wallet pubkey of the connected user — highlights their orders with "YOU" */
  userPubkey?: string;
  /** True when settlement deadline has passed and the book is read-only */
  isTradingClosed?: boolean;
  marketEndDate?: Date;
  isMarketCreator?: boolean;
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
function aggregateLevels(
  orders: BackendOrder[],
  userPubkey?: string
): PriceLevel[] {
  const map = new Map<number, { size: number; isUser: boolean }>();
  for (const order of orders) {
    const displayPrice = toDisplayPrice(order.price);
    const displaySize = toDisplayQty(order.remaining_quantity);
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

const StatusDot = ({
  status,
  hasData,
  isTradingClosed = false,
}: {
  status: WsStatus;
  hasData: boolean;
  isTradingClosed?: boolean;
}) => {
  if (isTradingClosed) {
    return (
      <span className="flex items-center gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="text-[10px] font-mono font-medium text-amber-400/80">
          Locked
        </span>
      </span>
    );
  }

  // When reconnecting but we already have data, look "live" — just syncing in background
  const effectiveStatus =
    status === "reconnecting" && hasData ? "connected" : status;
  const dotClass =
    effectiveStatus === "connected"
      ? "bg-emerald-500 animate-pulse"
      : effectiveStatus === "connecting" || effectiveStatus === "reconnecting"
        ? "bg-amber-400 animate-pulse"
        : "bg-red-500/70";
  const label =
    effectiveStatus === "connected"
      ? "Live"
      : effectiveStatus === "connecting"
        ? "Connecting…"
        : effectiveStatus === "reconnecting"
          ? "Reconnecting…"
          : "Offline";
  return (
    <span className="flex items-center gap-1">
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)} />
      <span className="text-[10px] font-mono font-medium text-muted-foreground/50">
        {label}
      </span>
    </span>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────

export const OrderBook = ({
  marketId,
  yesPrice,
  noPrice,
  selectedTokenType = "yes",
  userPubkey,
  isTradingClosed = false,
  marketEndDate,
  isMarketCreator = false,
}: OrderBookProps) => {
  const numericId = parseInt(marketId, 10);
  const validId = isNaN(numericId) ? null : numericId;
  const tradingClosedLabel = marketEndDate
    ? marketEndDate.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const closedMessage = isMarketCreator
    ? "You're the market creator. Settle this market to unlock claims and finish the trading cycle."
    : "This market is waiting on the creator to settle it before claims and payouts can open.";

  const { orderbook, status } = useOrderbookWs(validId);

  // ── Derive aggregated bids/asks from live orderbook ─────────────────────────
  const { asks, bids } = useMemo(() => {
    if (!orderbook)
      return { asks: [] as PriceLevel[], bids: [] as PriceLevel[] };

    const rawBids =
      selectedTokenType === "yes" ? orderbook.yes_bids : orderbook.no_bids;
    const rawAsks =
      selectedTokenType === "yes" ? orderbook.yes_asks : orderbook.no_asks;

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
    return selectedTokenType === "yes" ? yesPrice * 100 : noPrice * 100;
  }, [bids, asks, selectedTokenType, yesPrice, noPrice]);

  const spread = useMemo(() => {
    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;
    if (bestBid !== null && bestAsk !== null) return bestAsk - bestBid;
    return null;
  }, [bids, asks]);

  const maxTotal = Math.max(
    ...asks.map((a) => a.total),
    ...bids.map((b) => b.total),
    1
  );

  return (
    <div className="min-w-0 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/10 px-3 py-3 dark:border-border/8 sm:px-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
            Order Book
          </h3>
          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm",
              selectedTokenType === "yes"
                ? "bg-emerald-500/12 text-emerald-400/80"
                : "bg-red-500/12 text-red-400/80"
            )}
          >
            {selectedTokenType.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <StatusDot
            status={status}
            hasData={!!orderbook}
            isTradingClosed={isTradingClosed}
          />
          {orderbook && orderbook.slot > 0 && (
            <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/25 tabular-nums">
              slot {orderbook.slot.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {isTradingClosed && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-100/85 sm:mx-4">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">Order book locked</p>
            <p>
              {tradingClosedLabel
                ? `Trading closed on ${tradingClosedLabel}.`
                : "Trading is closed."}{" "}
              {closedMessage} No new orders, matches, or cancellations can
              happen until then.
            </p>
          </div>
        </div>
      )}

      {/* ── Connecting skeleton ── */}
      {!orderbook && (status === "connecting" || status === "reconnecting") && (
        <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
          <div className="h-4 w-4 rounded-full border-2 border-amber-400/60 border-t-transparent animate-spin" />
          <p className="text-[10px] font-mono text-muted-foreground/30 tracking-widest uppercase">
            {status === "connecting" ? "Connecting…" : "Reconnecting…"}
          </p>
        </div>
      )}

      {/* ── Disconnected ── */}
      {!orderbook && status === "disconnected" && (
        <div className="px-4 py-10 text-center">
          <p className="text-[11px] text-muted-foreground/40">
            No connection to backend.
          </p>
        </div>
      )}

      {/* ════════════════════ ORDER BOOK ════════════════════ */}
      {orderbook && (
        <div className="mt-3">
          {/* ── Fully empty state ── */}
          {asks.length === 0 && bids.length === 0 ? (
            <div className="px-4 py-12 flex flex-col items-center gap-2 text-center">
              <div className="grid grid-cols-2 gap-0.5 mb-1 opacity-20">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full bg-muted-foreground",
                      i % 2 === 0 ? "w-12" : "w-8"
                    )}
                  />
                ))}
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground/50 tracking-wide">
                {isTradingClosed ? "Order book closed" : "Order book is empty"}
              </p>
              <p className="text-[10px] text-muted-foreground/30">
                {isTradingClosed
                  ? "No bids or asks were left on the book when trading locked for settlement"
                  : "No open bids or asks right now"}
              </p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[minmax(0,1fr)_60px_52px] items-center border-b border-border/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 sm:grid-cols-[1fr_80px_64px] sm:px-4">
                <span>Price (¢)</span>
                <span className="pr-2 text-right sm:pr-3">Size</span>
                <span className="text-right">Total</span>
              </div>

              {/* ── Asks (reversed so best ask is closest to mid) ── */}
              <div>
                {asks.length === 0 && (
                  <div className="px-3 py-3 text-center font-mono text-[10px] text-muted-foreground/25 sm:px-4">
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
                        className={cn(
                          "group relative grid grid-cols-[minmax(0,1fr)_60px_52px] items-center px-3 py-1.5 transition-colors sm:grid-cols-[1fr_80px_64px] sm:px-4",
                          isTradingClosed ? "cursor-default" : "cursor-pointer"
                        )}
                      >
                        {/* Always-on subtle depth wash */}
                        <div
                          className="absolute right-0 inset-y-0 pointer-events-none bg-red-500/4"
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
                          <span className="text-[10px] font-normal opacity-40">
                            ¢
                          </span>
                          {ask.isUser && (
                            <span className="text-[9px] px-1 py-px rounded bg-amber-400/20 text-amber-400 font-bold tracking-wide leading-none">
                              YOU
                            </span>
                          )}
                        </span>
                        <span className="relative z-10 pr-2 text-right font-mono text-xs tabular-nums text-muted-foreground/60 sm:pr-3">
                          {formatSize(ask.size)}
                        </span>
                        <span className="relative z-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground/30">
                          {formatSize(ask.total)}
                        </span>
                      </div>
                    );
                  })}
              </div>

              {/* ── Mid price & spread ── */}
              <div className="border-y border-border/8 bg-muted/4 px-3 py-1.5 sm:px-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold font-mono tabular-nums tracking-tight">
                      {midPrice.toFixed(2)}
                      <span className="text-xs font-normal opacity-40 ml-0.5">
                        ¢
                      </span>
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
                  <div className="px-3 py-3 text-center font-mono text-[10px] text-muted-foreground/25 sm:px-4">
                    No bids
                  </div>
                )}
                {bids.map((bid, idx) => {
                  const depthPct = (bid.total / maxTotal) * 60;
                  const key = `bid-${idx}`;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "group relative grid grid-cols-[minmax(0,1fr)_60px_52px] items-center px-3 py-1.5 transition-colors sm:grid-cols-[1fr_80px_64px] sm:px-4",
                        isTradingClosed ? "cursor-default" : "cursor-pointer"
                      )}
                    >
                      <div
                        className="absolute right-0 inset-y-0 pointer-events-none bg-emerald-500/4"
                        style={{ width: `${depthPct * 0.6}%` }}
                      />
                      <div
                        className="absolute right-0 inset-y-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-500/[0.07]"
                        style={{ width: `${depthPct}%` }}
                      />
                      <div className="absolute left-0 top-[18%] bottom-[18%] w-0.5 rounded-r-full bg-emerald-500/50" />

                      <span className="relative z-10 flex items-center gap-1.5 font-mono text-emerald-400 font-semibold text-sm tabular-nums">
                        {bid.price.toFixed(1)}
                        <span className="text-[10px] font-normal opacity-40">
                          ¢
                        </span>
                        {bid.isUser && (
                          <span className="text-[9px] px-1 py-px rounded bg-amber-400/20 text-amber-400 font-bold tracking-wide leading-none">
                            YOU
                          </span>
                        )}
                      </span>
                      <span className="relative z-10 pr-2 text-right font-mono text-xs tabular-nums text-muted-foreground/60 sm:pr-3">
                        {formatSize(bid.size)}
                      </span>
                      <span className="relative z-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground/30">
                        {formatSize(bid.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
