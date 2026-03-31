'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletSession } from '@solana/react-hooks';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  fetchUserCreatedMarkets,
  fetchUserTrades,
  toDisplayPrice,
  toDisplayQty,
} from '@/lib/api/backend';
import type { BackendMarket, BackendTrade } from '@/lib/api/backend';
import { useUsdcBalance } from '@/hooks/use-usdc-balance';
import {
  Wallet,
  History,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Loader2,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatQty(qty: number): string {
  if (qty >= 1_000_000) return `${(qty / 1_000_000).toFixed(2)}M`;
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(1)}K`;
  return String(qty);
}

function marketStatusColor(status: BackendMarket['status']) {
  switch (status) {
    case 'Active': return 'bg-emerald-500/10 text-emerald-400';
    case 'Settled': return 'bg-blue-500/10 text-blue-400';
    case 'Closed': return 'bg-muted/30 text-muted-foreground';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Account() {
  const walletSession = useWalletSession();
  const userPubkey = walletSession?.account?.address as string | undefined;
  const { usdcBalance } = useUsdcBalance();

  const [createdMarkets, setCreatedMarkets] = useState<BackendMarket[]>([]);
  const [trades, setTrades] = useState<BackendTrade[]>([]);
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
      const [marketsData, tradesData] = await Promise.all([
        fetchUserCreatedMarkets(userPubkey),
        fetchUserTrades(userPubkey, 50),
      ]);
      setCreatedMarkets(marketsData);
      setTrades(tradesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  }, [userPubkey]);

  useEffect(() => { load(); }, [load]);

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
              Connect a Solana wallet to see your created markets and trade history.
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
            <p className="text-sm text-muted-foreground">Loading account data…</p>
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
              <h1 className="text-3xl font-bold tracking-tight mb-1">Account</h1>
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

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                label: 'USDC Balance',
                value: usdcBalance != null ? `$${usdcBalance.toLocaleString()}` : '—',
                icon: Wallet,
                sub: 'on-chain',
              },
              {
                label: 'Markets Created',
                value: createdMarkets.length.toString(),
                icon: TrendingUp,
                sub: 'as authority',
              },
              {
                label: 'Total Trades',
                value: trades.length.toString(),
                icon: History,
                sub: 'all markets',
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

          {/* Markets Created */}
          <div className="panel-card mb-6">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-400" />
                <h3 className="text-base font-semibold">Markets You Created</h3>
                <span className="text-xs text-muted-foreground">({createdMarkets.length})</span>
              </div>
            </div>
            <div className="p-5">
              {createdMarkets.length === 0 ? (
                <div className="text-center py-10">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No markets created yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Markets you initialize will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {createdMarkets.map((market) => (
                    <div
                      key={market.market_id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/10 hover:border-border/30 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-xs font-mono text-muted-foreground">
                            Market #{market.market_id}
                          </span>
                          <Badge
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 border-0',
                              marketStatusColor(market.status),
                            )}
                          >
                            {market.status}
                          </Badge>
                          {market.winning_outcome && (
                            <Badge className="text-[10px] px-2 py-0.5 border-0 bg-amber-500/10 text-amber-400">
                              {market.winning_outcome}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Closes {formatDate(market.settlement_deadline)}
                          </span>
                          <Separator orientation="vertical" className="h-3" />
                          <span>Created {new Date(market.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Link href={`/market/${market.market_id}`}>
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
                      const side = isTaker
                        ? trade.taker_side
                        : trade.taker_side === 'Buy'
                        ? 'Sell'
                        : 'Buy';
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
