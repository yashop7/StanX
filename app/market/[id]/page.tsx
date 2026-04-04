'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useWalletSession, useSendTransaction } from '@solana/react-hooks';
import { createWalletTransactionSigner } from '@solana/client';
import { toast } from 'sonner';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { TradingChartRecharts } from '@/components/TradingChartRecharts';
import { TradingPanelNew } from '@/components/TradingPanelNew';
import { OrderBook } from '@/components/OrderBook';
import { OnChainOrderBook } from '@/components/OnChainOrderBook';
import { MarketSwitcher } from '@/components/MarketSwitcher';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Share2, TrendingUp, Clock, Loader2, AlertCircle, Lock, Trophy, CheckCircle2, XCircle, MinusCircle, Activity, Youtube, ExternalLink } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { getMarketByIdAction, getMarketsAction } from '@/app/markets/actions';
import type { DisplayMarket } from '@/lib/blockchain/markets';
import { UserStatsCard } from '@/components/UserStatsCard';
import { buildCloseMarketInstruction, buildClaimRewardsInstruction, buildSetWinnerInstruction } from '@/lib/blockchain/market';
import { MarketCountdown, MarketCountdownBlocks } from '@/components/MarketCountdown';
import { fetchMarketTrades, fetchMarketResolution, toDisplayPrice, toDisplayQty } from '@/lib/api/backend';
import type { BackendTrade, MarketResolution } from '@/lib/api/backend';
import { formatNumber } from '@/app/create-market/metadata';

import { cn } from '@/lib/utils';
import { UserMarketOrders } from '@/components/UserMarketOrders';

const MarketDetail = () => {
  const params = useParams();
  const rawId = params?.id as string;
  const marketId = parseInt(rawId, 10);

  const [market, setMarket] = useState<DisplayMarket | null>(null);
  const [allMarkets, setAllMarkets] = useState<DisplayMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTokenType, setSelectedTokenType] = useState<'yes' | 'no'>('yes');
  const walletSession = useWalletSession();
  const userPubkey = walletSession?.account?.address as string | undefined;
  const { send } = useSendTransaction();
  const [actionBusy, setActionBusy] = useState<'close' | 'claim' | 'set-winner' | null>(null);

  const [marketTrades, setMarketTrades] = useState<BackendTrade[]>([]);
  const [resolution, setResolution] = useState<MarketResolution | null>(null);
  const [resolutionLoading, setResolutionLoading] = useState(false);

  const load = useCallback(async () => {
    if (isNaN(marketId)) {
      setError('Invalid market ID');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    // Fetch the specific market and all markets for the switcher in parallel
    const [marketResult, marketsResult] = await Promise.all([
      getMarketByIdAction(marketId),
      getMarketsAction(),
    ]);
    if (marketResult.success && marketResult.market) {
      setMarket(marketResult.market);
    } else {
      setError(marketResult.error ?? 'Market not found');
    }
    if (marketsResult.success && marketsResult.markets) {
      setAllMarkets(marketsResult.markets);
    }
    setIsLoading(false);
  }, [marketId]);

  useEffect(() => { load(); }, [load]);

  // Fetch market trades from backend
  const loadTrades = useCallback(() => {
    if (isNaN(marketId)) return;
    fetchMarketTrades(marketId, 50)
      .then(setMarketTrades)
      .catch((e) => console.warn('[Backend] trades fetch failed:', e));
  }, [marketId]);

  useEffect(() => {
    loadTrades();
    const interval = setInterval(loadTrades, 15_000);
    return () => clearInterval(interval);
  }, [loadTrades]);

  // Poll for oracle resolution data when market is past deadline and unsettled
  useEffect(() => {
    if (!market || market.isSettled) return;
    if (new Date() < market.endDate) return;

    let cancelled = false;
    const poll = async () => {
      setResolutionLoading(true);
      try {
        const res = await fetchMarketResolution(marketId);
        if (!cancelled) setResolution(res);
      } catch {
        // oracle not ready yet — will retry
      } finally {
        if (!cancelled) setResolutionLoading(false);
      }
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [market, marketId]);

  /** Extract a human-readable message from a Solana transaction error. */
  function describeTxError(e: unknown): string {
    if (!(e instanceof Error)) return String(e);
    // Walk the error chain looking for a program Custom error code
    const stack: unknown[] = [e];
    while (stack.length) {
      const node: unknown = stack.pop();
      if (!node || typeof node !== 'object') continue;
      const obj = node as Record<string, unknown>;
      // @solana/kit SolanaError stores context.code for program errors
      if (typeof obj['code'] === 'number') {
        const code: number = obj['code'];
        // Map our known program error codes to friendly messages
        const KNOWN: Record<number, string> = {
          0x1771: 'Invalid settlement deadline',
          0x1772: 'Market already settled',
          0x1773: 'Market has expired',
          0x177a: 'Market is not settled yet',
          0x177b: 'Winning outcome is not set yet',
          0x1780: 'Not authorized — wallet must be the market creator',
          0x178b: 'Settlement deadline has not been reached yet — market is still live',
        };
        if (KNOWN[code]) return KNOWN[code];
      }
      // Also check transactionPlanResult for nested errors
      if (obj['transactionPlanResult']) stack.push(obj['transactionPlanResult']);
      if (obj['cause']) stack.push(obj['cause']);
      if (obj['context']) stack.push(obj['context']);
    }
    return (e as Error).message;
  }

  async function handleSetWinner(outcome: 'YES' | 'NO' | 'NEITHER') {
    if (!walletSession) { toast.error('Connect your wallet first.'); return; }
    if (market && new Date() < market.endDate) {
      toast.error('Settlement deadline not reached', {
        description: `The market closes ${formatDistanceToNow(market.endDate, { addSuffix: true })}. You can resolve it after that.`,
      });
      return;
    }
    setActionBusy('set-winner');
    try {
      const { signer } = createWalletTransactionSigner(walletSession);
      const ix = await buildSetWinnerInstruction({ userSigner: signer, marketId, outcome });
      await send({ instructions: [ix], authority: signer });
      toast.success(`Market resolved — ${outcome === 'NEITHER' ? 'Neither' : outcome} wins!`);
      load();
    } catch (e) {
      toast.error('Failed to set winner', { description: describeTxError(e) });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCloseMarket() {
    if (!walletSession) { toast.error('Connect your wallet first.'); return; }
    setActionBusy('close');
    try {
      const { signer } = createWalletTransactionSigner(walletSession);
      const ix = await buildCloseMarketInstruction({ userSigner: signer, marketId });
      await send({ instructions: [ix], authority: signer });
      toast.success('Market closed successfully.');
      load();
    } catch (e) {
      toast.error('Close failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleClaimRewards() {
    if (!walletSession) { toast.error('Connect your wallet first.'); return; }
    setActionBusy('claim');
    try {
      const { signer } = createWalletTransactionSigner(walletSession);
      const ix = await buildClaimRewardsInstruction({ userSigner: signer, marketId });
      const sig = await send({ instructions: [ix], authority: signer });
      toast.success('Rewards claimed!', {
        description: `Winnings transferred to your wallet — tx: ${String(sig).slice(0, 8)}…`,
        duration: 6000,
      });
      load();
    } catch (e) {
      toast.error('Claim failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setActionBusy(null);
    }
  }

  const formatVolume = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toFixed(2)}`;
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Fetching market #{isNaN(marketId) ? rawId : marketId} from Solana…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error / not found state ────────────────────────────────────────────────
  if (error || !market) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-2xl font-bold">Market Not Found</h2>
            <p className="text-muted-foreground">{error ?? `Market #${marketId} does not exist on-chain.`}</p>
            <Button asChild>
              <Link href="/markets">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Markets
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Market found — render detail ───────────────────────────────────────────
  const marketIdStr = market.marketId.toString();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <PageTransition>
        <main className="flex-1 container mx-auto px-4 py-6 md:py-8 max-w-7xl">
          {/* Back Button */}
          <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground hover:text-foreground" asChild>
            <Link href="/markets">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Markets
            </Link>
          </Button>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-6">
              {/* Market Header */}
              <div className="panel-card p-5">
                <div className="flex gap-4">
                  <div className="shrink-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden ring-1 ring-border/50 bg-muted">
                      <img
                        src={market.image}
                        alt={market.question}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5 bg-muted/80">
                        {market.category}
                      </Badge>
                      <Badge className={`text-[10px] font-medium px-2 py-0.5 border-0 ${
                        market.isSettled
                          ? 'bg-gray-500/15 text-gray-400'
                          : market.status === 'ending-soon'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-emerald-500/15 text-emerald-500'
                      }`}>
                        {market.isSettled ? 'Settled' : market.status === 'ending-soon' ? 'Ending Soon' : 'Live'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 text-muted-foreground">
                        #{market.marketId}
                      </Badge>
                    </div>

                    <h1 className="text-base font-semibold leading-snug line-clamp-2 text-foreground">
                      {market.question}
                    </h1>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg"
                      onClick={() => {
                        const url = window.location.href;
                        navigator.clipboard.writeText(url).then(() => {
                          toast.success('Link copied!', { description: url });
                        });
                      }}
                      title="Copy link"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border/20 dark:border-border/10 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground/80">{formatVolume(market.volume)}</span>
                  </span>
                  <span className="text-xs font-mono text-muted-foreground/60">
                    YES {(market.yesPrice * 100).toFixed(1)}¢ · NO {(market.noPrice * 100).toFixed(1)}¢
                  </span>
                  {market.videoId && (
                    <a
                      href={market.videoUrl ?? `https://youtube.com/watch?v=${market.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 ml-auto text-muted-foreground/50 hover:text-red-400 transition-colors"
                    >
                      <Youtube className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium">Watch Video</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Settlement Deadline — dedicated segmented block row */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/10 dark:border-border/[0.06]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest leading-none">
                      {market.isSettled ? 'Resolved' : 'Resolves In'}
                    </span>
                    {!market.isSettled && (
                      <span className="text-[10px] text-muted-foreground/40 font-mono">
                        {market.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <MarketCountdownBlocks targetDate={market.endDate} isSettled={market.isSettled} />
                </div>
              </div>

              {/* ── Resolution Banner ──────────────────────────────── */}
              {market.isSettled && (() => {
                const isYes = market.winningOutcome === 'YES';
                const isNo  = market.winningOutcome === 'NO';
                const isNeither = market.winningOutcome === 'NEITHER';
                const accentColor = isYes ? 'emerald' : isNo ? 'red' : 'muted';

                return (
                  <div className={cn(
                    "rounded-xl border bg-card p-5 flex items-center justify-between gap-4",
                    isYes ? 'border-emerald-500/25' :
                    isNo  ? 'border-red-500/25' :
                            'border-border'
                  )}>
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                        isYes ? 'bg-emerald-500/10' :
                        isNo  ? 'bg-red-500/10' :
                                'bg-muted/30'
                      )}>
                        <Trophy className={cn(
                          "h-4 w-4",
                          isYes ? 'text-emerald-400' : isNo ? 'text-red-400' : 'text-muted-foreground'
                        )} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-0.5">
                          Market Resolved
                        </p>
                        <p className={cn(
                          "text-base font-semibold",
                          isYes ? 'text-emerald-400' : isNo ? 'text-red-400' : 'text-foreground'
                        )}>
                          {isNeither ? 'No winner — proportional return' : `${market.winningOutcome} wins · $1.00 per token`}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-1 rounded-md border shrink-0",
                      isYes ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      isNo  ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                              'bg-muted/30 border-border text-muted-foreground'
                    )}>
                      Final
                    </span>
                  </div>
                );
              })()}

              {/* Trading Chart */}
              <TradingChartRecharts marketId={marketId} token={selectedTokenType} volume={market.volume} />

              {/* ── Market Activity — Order Book + Live Trades unified ─── */}
              <div className="panel-card overflow-hidden">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/10 dark:border-border/[0.08]">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Market Activity
                  </h3>
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-500/70 font-medium">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>

                <Tabs defaultValue="orderbook" className="w-full">
                  <div className="px-4 pt-3 pb-0">
                    <TabsList className="h-8 bg-muted/20 dark:bg-muted/[0.08] p-0.5 rounded-lg border border-border/15 dark:border-border/[0.08] gap-0.5">
                      <TabsTrigger
                        value="orderbook"
                        className="h-7 px-3 text-[11px] font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      >
                        Order Book
                      </TabsTrigger>
                      <TabsTrigger
                        value="trades"
                        className="h-7 px-3 text-[11px] font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      >
                        Live Trades
                        {marketTrades.length > 0 && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-[1px] rounded-full bg-emerald-500/15 text-emerald-400 font-bold tabular-nums">
                            {marketTrades.length}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Order Book tab */}
                  <TabsContent value="orderbook" className="mt-0 p-4 space-y-4">
                    <OrderBook
                      marketId={marketIdStr}
                      yesPrice={market.yesPrice}
                      noPrice={market.noPrice}
                      selectedTokenType={selectedTokenType}
                      userPubkey={userPubkey}
                    />
                    <OnChainOrderBook
                      marketId={marketIdStr}
                      yesPrice={market.yesPrice}
                      noPrice={market.noPrice}
                      selectedTokenType={selectedTokenType}
                      userPubkey={userPubkey}
                    />
                  </TabsContent>

                  {/* Live Trades tab */}
                  <TabsContent value="trades" className="mt-0">
                    {marketTrades.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                        <p className="text-sm text-muted-foreground/60">No trades yet</p>
                        <p className="text-xs text-muted-foreground/35">Trades appear here when the order book matches</p>
                      </div>
                    ) : (() => {
                      const maxQty = Math.max(...marketTrades.map(t => t.quantity));
                      return (
                        <>
                          {/* Column headers */}
                          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2 border-b border-border/[0.08] text-[9px] font-semibold text-muted-foreground/35 uppercase tracking-[0.12em]">
                            <span>Trade</span>
                            <span className="text-right pr-8">Price</span>
                            <span className="text-right w-20 pr-3">Size</span>
                            <span className="text-right w-10">When</span>
                          </div>

                          {/* Trade rows — scrollable */}
                          <div className="max-h-[30rem] overflow-y-auto scrollbar-thin divide-y divide-border/[0.06]">
                            {marketTrades.map((trade) => {
                              const isBuy = trade.taker_side === 'Buy';
                              const isYes = trade.token_type === 'Yes';
                              const depthPct = (trade.quantity / maxQty) * 48;
                              const price = toDisplayPrice(trade.price);
                              const qty   = toDisplayQty(trade.quantity);
                              const sAgo  = Math.floor(Date.now() / 1000 - trade.event_timestamp);
                              const timeStr = sAgo < 60 ? `${sAgo}s`
                                : sAgo < 3600 ? `${Math.floor(sAgo / 60)}m`
                                : sAgo < 86400 ? `${Math.floor(sAgo / 3600)}h`
                                : `${Math.floor(sAgo / 86400)}d`;

                              return (
                                <div
                                  key={trade.id}
                                  className="relative grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-[9px] hover:bg-muted/[0.03] transition-colors group"
                                >
                                  {/* Depth fill — washes in from right */}
                                  <div
                                    className={cn(
                                      'absolute right-0 inset-y-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity',
                                      isBuy ? 'bg-emerald-500/[0.06]' : 'bg-red-500/[0.06]',
                                    )}
                                    style={{ width: `${depthPct}%` }}
                                  />
                                  {/* Always-on subtle depth indicator */}
                                  <div
                                    className={cn(
                                      'absolute right-0 inset-y-0 pointer-events-none',
                                      isBuy ? 'bg-emerald-500/[0.04]' : 'bg-red-500/[0.04]',
                                    )}
                                    style={{ width: `${depthPct * 0.6}%` }}
                                  />

                                  {/* Left accent bar */}
                                  <div
                                    className={cn(
                                      'absolute left-0 top-[18%] bottom-[18%] w-[2px] rounded-r-full',
                                      isBuy ? 'bg-emerald-500/50' : 'bg-red-500/50',
                                    )}
                                  />

                                  {/* Trade descriptor */}
                                  <div className="flex items-center gap-2 z-10 min-w-0">
                                    <span
                                      className={cn(
                                        'text-[11px] font-bold leading-none shrink-0',
                                        isBuy ? 'text-emerald-400' : 'text-red-400',
                                      )}
                                    >
                                      {isBuy ? 'BUY' : 'SELL'}
                                    </span>
                                    <span
                                      className={cn(
                                        'text-[9px] font-semibold px-1.5 py-[2px] rounded-sm leading-none shrink-0',
                                        isYes
                                          ? 'bg-emerald-500/12 text-emerald-400/80'
                                          : 'bg-red-500/12 text-red-400/80',
                                      )}
                                    >
                                      {trade.token_type.toUpperCase()}
                                    </span>
                                  </div>

                                  {/* Price */}
                                  <div className="text-right pr-8 z-10">
                                    <span
                                      className={cn(
                                        'font-mono font-semibold text-[13px] tabular-nums',
                                        isBuy ? 'text-emerald-400' : 'text-red-400',
                                      )}
                                    >
                                      {price.toFixed(1)}
                                      <span className="text-[10px] font-normal opacity-50">¢</span>
                                    </span>
                                  </div>

                                  {/* Quantity */}
                                  <div className="text-right w-20 pr-3 z-10">
                                    <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">
                                      {qty >= 1000 ? `${(qty / 1000).toFixed(1)}K` : qty.toFixed(qty < 10 ? 2 : 0)}
                                    </span>
                                  </div>

                                  {/* Time */}
                                  <div className="text-right w-10 z-10">
                                    <span className="font-mono text-[10px] text-muted-foreground/30 tabular-nums">
                                      {timeStr}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Footer bar */}
                          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/[0.08]">
                            <span className="text-[10px] text-muted-foreground/35 tabular-nums">
                              {marketTrades.length} executions
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/35">
                              <span className="inline-block h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                              refreshes every 15s
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              </div>

              {/* ── Info — About + My Orders ────────────────────────────── */}
              <Tabs defaultValue="about" className="w-full">
                <TabsList className="w-full justify-start h-10 bg-muted/20 dark:bg-muted/10 p-1 rounded-xl border border-border/20 dark:border-border/10">
                  <TabsTrigger value="about" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    About
                  </TabsTrigger>
                  <TabsTrigger value="my-orders" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    My Orders
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="about" className="space-y-4 mt-4">
                  <Card className="panel-card">
                    <CardContent className="pt-5 pb-5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h4>
                      <p className="text-sm text-foreground/80 leading-relaxed">{market.description}</p>
                    </CardContent>
                  </Card>
                  <Card className="panel-card">
                    <CardContent className="pt-5 pb-5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resolution Criteria</h4>
                      <p className="text-sm text-foreground/80 leading-relaxed">{market.resolutionCriteria}</p>
                    </CardContent>
                  </Card>
                  {market.metaDataUrl && (
                    <Card className="panel-card">
                      <CardContent className="pt-5 pb-5">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">On-chain Metadata</h4>
                        <a
                          href={market.metaDataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-mono text-primary hover:underline break-all"
                        >
                          {market.metaDataUrl}
                        </a>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="my-orders" className="mt-4">
                  <Card className="panel-card">
                    <CardContent className="pt-5 pb-5">
                      <UserMarketOrders marketId={marketId} userPubkey={userPubkey} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-4">
              <div className="sticky top-20 space-y-6">
                <TradingPanelNew
                  marketId={marketIdStr}
                  yesPrice={market.yesPrice}
                  noPrice={market.noPrice}
                  collateralMint={market.collateralMint}
                  outcomeYesMint={market.outcomeYesMint}
                  outcomeNoMint={market.outcomeNoMint}
                  selectedTokenType={selectedTokenType}
                  onTokenTypeChange={setSelectedTokenType}
                  isSettled={market.isSettled}
                  winningOutcome={market.winningOutcome}
                />

                {/* User Position Stats */}
                <UserStatsCard
                  marketId={market.marketId}
                  outcomeYesMint={market.outcomeYesMint}
                  outcomeNoMint={market.outcomeNoMint}
                  isSettled={market.isSettled}
                  winningOutcome={market.winningOutcome}
                />

                {/* ── Creator Actions Panel ───────────────────────────── */}
                {userPubkey === market.authority && (
                  <div className="panel-card p-5 space-y-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      Creator Actions
                    </h4>

                    {/* Resolve Market — only if not settled yet */}
                    {!market.isSettled ? (() => {
                      const deadlinePassed = new Date() >= market.endDate;
                      return (
                        <div className="space-y-3">
                          {!deadlinePassed ? (
                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <Clock className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-amber-400 leading-snug">
                                Settlement deadline not reached yet. You can resolve{' '}
                                <span className="font-semibold">{formatDistanceToNow(market.endDate, { addSuffix: true })}</span>.
                              </p>
                            </div>
                          ) : resolution ? (
                            /* Oracle has computed the result — show it and let creator confirm */
                            <div className="space-y-3">
                              <div className={cn(
                                'p-3 rounded-lg border',
                                resolution.outcome === 'OutcomeA'
                                  ? 'bg-emerald-500/10 border-emerald-500/30'
                                  : 'bg-red-500/10 border-red-500/30',
                              )}>
                                <div className="flex items-center gap-2 mb-2">
                                  {resolution.outcome === 'OutcomeA'
                                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    : <XCircle className="h-4 w-4 text-red-400" />
                                  }
                                  <span className={cn(
                                    'text-sm font-semibold',
                                    resolution.outcome === 'OutcomeA' ? 'text-emerald-400' : 'text-red-400',
                                  )}>
                                    {resolution.outcome === 'OutcomeA' ? 'YES wins' : 'NO wins'} — Target {resolution.outcome === 'OutcomeA' ? 'met' : 'not met'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="p-2 rounded-md bg-background/40">
                                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Actual</p>
                                    <p className="font-bold tabular-nums">{formatNumber(resolution.actual_value)}</p>
                                  </div>
                                  <div className="p-2 rounded-md bg-background/40">
                                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Target</p>
                                    <p className="font-bold tabular-nums">{formatNumber(resolution.threshold)}</p>
                                  </div>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Confirm the outcome below to settle the market on-chain. This is irreversible.
                              </p>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant={resolution.outcome === 'OutcomeA' ? 'success' : 'destructive'}
                                    size="sm"
                                    disabled={actionBusy !== null}
                                    className="w-full gap-2 font-semibold"
                                  >
                                    {resolution.outcome === 'OutcomeA'
                                      ? <><CheckCircle2 className="h-4 w-4" /> Settle as YES Wins</>
                                      : <><XCircle className="h-4 w-4" /> Settle as NO Wins</>
                                    }
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Settle market as &quot;{resolution.outcome === 'OutcomeA' ? 'YES' : 'NO'} wins&quot;?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      The oracle reports {formatNumber(resolution.actual_value)} {resolution.metric} (target: {formatNumber(resolution.threshold)}).
                                      This will settle the market on-chain and allow winners to claim rewards. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleSetWinner(resolution.outcome === 'OutcomeA' ? 'YES' : 'NO')}
                                      className={resolution.outcome === 'OutcomeA' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}
                                    >
                                      {actionBusy === 'set-winner'
                                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Settling...</>
                                        : `Confirm — ${resolution.outcome === 'OutcomeA' ? 'YES' : 'NO'} Wins`
                                      }
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : resolutionLoading ? (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                Fetching resolution data from oracle...
                              </p>
                            </div>
                          ) : (
                            /* Deadline passed but oracle hasn't computed yet — show manual fallback */
                            <div className="space-y-3">
                              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                                <Activity className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                  Oracle resolution pending. You can settle manually or wait for automatic resolution.
                                </p>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Select the outcome to resolve this market. This action is irreversible.
                              </p>
                              <div className="grid grid-cols-3 gap-2">
                                {(['YES', 'NO', 'NEITHER'] as const).map((outcome) => {
                                  const Icon = outcome === 'YES' ? CheckCircle2 : outcome === 'NO' ? XCircle : MinusCircle;
                                  const label = outcome === 'NEITHER' ? 'Neither' : outcome;
                                  const colorClass =
                                    outcome === 'YES' ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/60' :
                                    outcome === 'NO'  ? 'border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60' :
                                                        'border-border/40 text-muted-foreground hover:bg-muted/20';
                                  return (
                                    <AlertDialog key={outcome}>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={actionBusy !== null}
                                          className={`gap-1.5 text-xs font-semibold ${colorClass}`}
                                        >
                                          <Icon className="h-3.5 w-3.5" />
                                          {label}
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Resolve market as &quot;{label} wins&quot;?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will settle the market on-chain and allow winners to claim rewards.
                                            This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleSetWinner(outcome)}
                                            className={outcome === 'YES' ? 'bg-emerald-600 hover:bg-emerald-500' : outcome === 'NO' ? 'bg-red-600 hover:bg-red-500' : ''}
                                          >
                                            {actionBusy === 'set-winner'
                                              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Setting...</>
                                              : `Confirm — ${label} Wins`
                                            }
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          Market resolved —{' '}
                          <span className="font-semibold text-foreground">
                            {market.winningOutcome === 'YES' ? 'YES wins' : market.winningOutcome === 'NO' ? 'NO wins' : 'Neither wins'}
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Close Market — only show after settlement */}
                    {market.isSettled && (
                      <>
                        <div className="border-t border-border/20" />
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-muted-foreground">
                            Permanently closes the market account and reclaims rent. Requires all orders cancelled and all rewards claimed.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-border/40 text-muted-foreground hover:text-foreground"
                            disabled={actionBusy !== null}
                            onClick={handleCloseMarket}
                          >
                            {actionBusy === 'close'
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Lock className="h-4 w-4" />
                            }
                            {actionBusy === 'close' ? 'Closing...' : 'Close Market'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Claim Rewards — any user when winner is set ──────── */}
                {market.isSettled && market.winningOutcome && market.winningOutcome !== 'NEITHER' && (
                  <div className="panel-card p-5 space-y-3">
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Trophy className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-400 font-semibold">
                        {market.winningOutcome === 'YES' ? 'YES' : 'NO'} wins — claim your rewards
                      </span>
                    </div>
                    <Button
                      className="w-full gap-2 bg-success hover:brightness-110 text-white shadow-sm shadow-success/20"
                      disabled={actionBusy !== null}
                      onClick={handleClaimRewards}
                    >
                      {actionBusy === 'claim'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trophy className="h-4 w-4" />
                      }
                      {actionBusy === 'claim' ? 'Claiming…' : 'Claim Rewards'}
                    </Button>
                  </div>
                )}

                {/* Market Info */}
                <div className="panel-card p-5 space-y-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Market Info</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="stat-box">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Volume</div>
                      <div className="text-sm font-semibold font-mono">{formatVolume(market.volume)}</div>
                    </div>
                    <div className="stat-box">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Market ID</div>
                      <div className="text-sm font-semibold font-mono">#{market.marketId}</div>
                    </div>
                    <div className="stat-box">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Closes</div>
                      <div className="text-sm font-semibold font-mono">{formatDistanceToNow(market.endDate, { addSuffix: false })}</div>
                    </div>
                    <div className="stat-box">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Status</div>
                      <div className="text-sm font-semibold font-mono capitalize">{market.status}</div>
                    </div>
                  </div>
                </div>


                {/* Market Switcher */}
                <MarketSwitcher markets={allMarkets} currentMarketId={marketIdStr} />
              </div>
            </div>
          </div>
        </main>
      </PageTransition>
    </div>
  );
};

export default MarketDetail;