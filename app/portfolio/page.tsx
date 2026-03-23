'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletSession } from '@solana/react-hooks';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  fetchUserTrades,
  fetchBackendMarkets,
  fetchUserMarketOrders,
  toDisplayPrice,
  toDisplayQty,
} from '@/lib/api/backend';
import type { BackendTrade, BackendOrder, BackendMarket } from '@/lib/api/backend';
import { useUsdcBalance } from '@/hooks/use-usdc-balance';
import {
  TrendingUp,
  Wallet,
  Activity,
  ArrowDownUp,
  History,
  Clock,
  RefreshCw,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() / 1000) - ts);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatQty(qty: number): string {
  if (qty >= 1_000_000) return `${(qty / 1_000_000).toFixed(2)}M`;
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(1)}K`;
  return String(qty);
}

function statusColor(status: BackendOrder['status']) {
  switch (status) {
    case 'Open': return 'bg-emerald-500/10 text-emerald-400';
    case 'PartiallyFilled': return 'bg-amber-500/10 text-amber-400';
    case 'Filled': return 'bg-blue-500/10 text-blue-400';
    case 'Cancelled': return 'bg-muted/30 text-muted-foreground';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const walletSession = useWalletSession();
  const userPubkey = walletSession?.account?.address as string | undefined;
  const { usdcBalance } = useUsdcBalance();

  const [trades, setTrades] = useState<BackendTrade[]>([]);
  const [openOrders, setOpenOrders] = useState<BackendOrder[]>([]);
  const [markets, setMarkets] = useState<BackendMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userPubkey) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Fetch trades + markets in parallel
      const [tradesData, marketsData] = await Promise.all([
        fetchUserTrades(userPubkey, 100),
        fetchBackendMarkets(),
      ]);
      setTrades(tradesData);
      setMarkets(marketsData);

      // Build full set of market IDs: listed markets + any market the user traded in
      // (backend /markets may not include every market if e.g. status is non-Active)
      const listedIds = new Set(marketsData.map((m) => m.market_id));
      const tradeIds  = tradesData.map((t) => t.market_id).filter((id) => !listedIds.has(id));
      const allMarketIds = [...listedIds, ...tradeIds];

      // Fetch user orders for every market in parallel, merge results
      const orderArrays = await Promise.all(
        allMarketIds.map((id) =>
          fetchUserMarketOrders(id, userPubkey).catch(() => [] as BackendOrder[]),
        ),
      );
      const allOrders = orderArrays.flat();
      // Show only live orders (open + partial) at top, rest below
      allOrders.sort((a, b) => {
        const rankA = a.status === 'Open' ? 0 : a.status === 'PartiallyFilled' ? 1 : 2;
        const rankB = b.status === 'Open' ? 0 : b.status === 'PartiallyFilled' ? 1 : 2;
        if (rankA !== rankB) return rankA - rankB;
        return b.placed_at - a.placed_at;
      });
      setOpenOrders(allOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
    } finally {
      setIsLoading(false);
    }
  }, [userPubkey]);

  useEffect(() => { load(); }, [load]);

  const liveOrders = openOrders.filter(
    (o) => o.status === 'Open' || o.status === 'PartiallyFilled',
  );

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!userPubkey && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 px-4">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h2 className="text-xl font-semibold">Connect your wallet</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Connect a Solana wallet to see your orders, trades, and portfolio data.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading portfolio from backend…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <PageTransition>
        <main className="flex-1 container mx-auto px-4 py-8 pt-12 max-w-5xl">
          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Backend Live
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                {userPubkey}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={load}
              disabled={isLoading}
              className="gap-2 text-muted-foreground"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: 'USDC Balance',
                value: usdcBalance != null ? `$${usdcBalance.toLocaleString()}` : '—',
                icon: Wallet,
                sub: 'on-chain',
              },
              {
                label: 'Open Orders',
                value: liveOrders.length.toString(),
                icon: ArrowDownUp,
                sub: `across ${markets.length} markets`,
              },
              {
                label: 'Total Trades',
                value: trades.length.toString(),
                icon: Activity,
                sub: 'all markets',
              },
              {
                label: 'Markets',
                value: markets.length.toString(),
                icon: TrendingUp,
                sub: 'active on backend',
              },
            ].map((stat, i) => (
              <div key={i} className="panel-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-muted/50">
                    <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </span>
                </div>
                <div className="text-2xl font-bold tracking-tight tabular-nums">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Open Orders */}
          <div className="panel-card mb-6">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownUp className="h-4 w-4 text-purple-400" />
                <h3 className="text-base font-semibold">Open Orders</h3>
                <span className="text-xs text-muted-foreground">({liveOrders.length})</span>
              </div>
            </div>
            <div className="p-5">
              {liveOrders.length === 0 ? (
                <div className="text-center py-10">
                  <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No open orders</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Place limit orders to see them here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {liveOrders.map((order) => (
                    <div
                      key={`${order.market_id}-${order.order_id}`}
                      className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/10 hover:border-border/30 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <Link
                            href={`/market/${order.market_id}`}
                            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Market #{order.market_id}
                          </Link>
                          <Badge
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 border-0',
                              order.side === 'Buy'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400',
                            )}
                          >
                            {order.side}
                          </Badge>
                          <Badge
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 border-0',
                              order.token_type === 'Yes'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400',
                            )}
                          >
                            {order.token_type}
                          </Badge>
                          <Badge className={cn('text-[10px] px-2 py-0.5 border-0', statusColor(order.status))}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            <span className="font-mono font-semibold text-foreground/80">
                              {toDisplayPrice(order.price).toFixed(1)}¢
                            </span>{' '}
                            limit
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>
                            {formatQty(toDisplayQty(order.remaining_quantity))}/{formatQty(toDisplayQty(order.original_quantity))} remaining
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{formatTimeAgo(order.placed_at)}</span>
                        </div>
                      </div>
                      <Link href={`/market/${order.market_id}`}>
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Trade History */}
          <div className="panel-card">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-purple-400" />
                <h3 className="text-base font-semibold">Trade History</h3>
                <span className="text-xs text-muted-foreground">({trades.length})</span>
              </div>
            </div>
            <div className="p-5">
              {trades.length === 0 ? (
                <div className="text-center py-10">
                  <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No trades yet</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="grid grid-cols-5 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20 mb-2">
                    <span>Market</span>
                    <span>Side / Token</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Time</span>
                  </div>
                  <div className="space-y-0.5 max-h-120 overflow-y-auto">
                    {trades.map((trade) => {
                      const isTaker = trade.taker === userPubkey;
                      const side = isTaker ? trade.taker_side : (trade.taker_side === 'Buy' ? 'Sell' : 'Buy');
                      return (
                        <div
                          key={trade.id}
                          className="grid grid-cols-5 items-center px-3 py-2.5 text-xs rounded-lg hover:bg-muted/10 transition-colors"
                        >
                          <Link
                            href={`/market/${trade.market_id}`}
                            className="font-mono text-muted-foreground hover:text-foreground transition-colors"
                          >
                            #{trade.market_id}
                          </Link>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'font-semibold',
                                side === 'Buy' ? 'text-emerald-400' : 'text-red-400',
                              )}
                            >
                              {side}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded',
                                trade.token_type === 'Yes'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-red-500/10 text-red-400',
                              )}
                            >
                              {trade.token_type}
                            </span>
                            {isTaker ? (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">
                                TAKER
                              </span>
                            ) : (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold">
                                MAKER
                              </span>
                            )}
                          </div>
                          <span className="text-right font-mono font-semibold">
                            {toDisplayPrice(trade.price).toFixed(1)}¢
                          </span>
                          <span className="text-right font-mono text-muted-foreground">
                            {formatQty(toDisplayQty(trade.quantity))}
                          </span>
                          <span className="text-right text-muted-foreground">
                            {formatTimeAgo(trade.event_timestamp)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
}
