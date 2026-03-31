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
import { ArrowLeft, Share2, Bookmark, TrendingUp, Clock, Loader2, AlertCircle, Lock, Trophy, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
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
import { fetchMarketTrades, toDisplayPrice, toDisplayQty } from '@/lib/api/backend';
import type { BackendTrade } from '@/lib/api/backend';

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
      await send({ instructions: [ix], authority: signer });
      toast.success('Rewards claimed successfully!');
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg">
                      <Bookmark className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border/20 dark:border-border/10 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground/80">{formatVolume(market.volume)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground/80">{formatDistanceToNow(market.endDate, { addSuffix: false })}</span>
                  </span>
                  <span className="text-xs font-mono text-muted-foreground/60">
                    YES {(market.yesPrice * 100).toFixed(1)}¢ · NO {(market.noPrice * 100).toFixed(1)}¢
                  </span>
                </div>
              </div>

              {/* Trading Chart */}
              <TradingChartRecharts data={market.priceHistory} />

              {/* Order Books — side-by-side comparison */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Order Book Comparison
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
                    Testing
                  </span>
                </div>
                <div className="space-y-4">
                  {/* Backend WebSocket orderbook */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium px-1 flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Backend (WebSocket)
                    </p>
                    <OrderBook
                      marketId={marketIdStr}
                      yesPrice={market.yesPrice}
                      noPrice={market.noPrice}
                      selectedTokenType={selectedTokenType}
                      userPubkey={userPubkey}
                    />
                  </div>

                  {/* On-chain RPC orderbook */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium px-1 flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                      On-Chain (RPC Poll)
                    </p>
                    <OnChainOrderBook
                      marketId={marketIdStr}
                      yesPrice={market.yesPrice}
                      noPrice={market.noPrice}
                      selectedTokenType={selectedTokenType}
                      userPubkey={userPubkey}
                    />
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="about" className="w-full">
                <TabsList className="w-full justify-start h-10 bg-muted/20 dark:bg-muted/10 p-1 rounded-xl border border-border/20 dark:border-border/10">
                  <TabsTrigger value="about" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">About</TabsTrigger>
                  <TabsTrigger value="my-orders" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    My Orders
                  </TabsTrigger>
                  <TabsTrigger value="trades" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Trades
                    {marketTrades.length > 0 && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-bold">
                        {marketTrades.length}
                      </span>
                    )}
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

                {/* My Orders Tab — fetches directly from backend */}
                <TabsContent value="my-orders" className="mt-4">
                  <Card className="panel-card">
                    <CardContent className="pt-5 pb-5">
                      <UserMarketOrders marketId={marketId} userPubkey={userPubkey} />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Market Trades Tab */}
                <TabsContent value="trades" className="mt-4">
                  <Card className="panel-card">
                    <CardContent className="pt-5 pb-5">
                      {marketTrades.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No trades yet.</p>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="grid grid-cols-4 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20 mb-1">
                            <span>Side</span>
                            <span>Token</span>
                            <span className="text-right">Price</span>
                            <span className="text-right">Qty</span>
                          </div>
                          <div className="max-h-96 overflow-y-auto space-y-0.5">
                            {marketTrades.map((trade) => (
                              <div
                                key={trade.id}
                                className="grid grid-cols-4 items-center px-3 py-2 text-xs rounded-lg hover:bg-muted/10 transition-colors"
                              >
                                <span className={cn('font-semibold', trade.taker_side === 'Buy' ? 'text-emerald-400' : 'text-red-400')}>
                                  {trade.taker_side}
                                </span>
                                <span className={cn('font-mono text-[11px]', trade.token_type === 'Yes' ? 'text-emerald-400' : 'text-red-400')}>
                                  {trade.token_type}
                                </span>
                                <span className="text-right font-mono font-semibold">{toDisplayPrice(trade.price).toFixed(1)}¢</span>
                                <span className="text-right font-mono text-muted-foreground">{toDisplayQty(trade.quantity).toFixed(4)}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground/50 px-3 pt-2">
                            Showing {marketTrades.length} most recent · refreshes every 15s
                          </p>
                        </div>
                      )}
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
                />

                {/* User Position Stats */}
                <UserStatsCard
                  marketId={market.marketId}
                  outcomeYesMint={market.outcomeYesMint}
                  outcomeNoMint={market.outcomeNoMint}
                />

                {/* ── Creator Actions Panel ───────────────────────────── */}
                {userPubkey === market.authority && (
                  <div className="panel-card p-5 space-y-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Creator Actions
                    </h4>

                    {/* Resolve Market — only if not settled yet */}
                    {!market.isSettled ? (() => {
                      const deadlinePassed = new Date() >= market.endDate;
                      return (
                        <div className="space-y-2">
                          {deadlinePassed ? (
                            <p className="text-[11px] text-muted-foreground">
                              Select the outcome to resolve this market. This action is irreversible.
                            </p>
                          ) : (
                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <Clock className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-amber-400 leading-snug">
                                Settlement deadline not reached yet. You can resolve{' '}
                                <span className="font-semibold">{formatDistanceToNow(market.endDate, { addSuffix: true })}</span>.
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2">
                            {(['YES', 'NO', 'NEITHER'] as const).map((outcome) => {
                              const Icon = outcome === 'YES' ? CheckCircle2 : outcome === 'NO' ? XCircle : MinusCircle;
                              const label = outcome === 'NEITHER' ? 'Neither' : outcome;
                              const colorClass = deadlinePassed
                                ? outcome === 'YES' ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/60' :
                                  outcome === 'NO'  ? 'border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60' :
                                                      'border-border/40 text-muted-foreground hover:bg-muted/20'
                                : 'border-border/20 text-muted-foreground/40 cursor-not-allowed';
                              return (
                                <AlertDialog key={outcome}>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={actionBusy !== null || !deadlinePassed}
                                      className={`gap-1.5 text-xs font-semibold ${colorClass}`}
                                    >
                                      <Icon className="h-3.5 w-3.5" />
                                      {label}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Resolve market as "{label} wins"?</AlertDialogTitle>
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
                                          ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Setting…</>
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

                    {/* Divider */}
                    <div className="border-t border-border/20" />

                    {/* Close Market */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        Permanently closes the market account and reclaims rent. Requires settlement, all orders cancelled, and all rewards claimed.
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
                        {actionBusy === 'close' ? 'Closing…' : 'Close Market'}
                      </Button>
                    </div>
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
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
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

                {/* Backend Market Info */}
                {marketTrades.length > 0 && (
                  <div className="panel-card p-5 space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Recent Trades (Backend)
                    </h4>
                    <div className="space-y-1.5">
                      {marketTrades.slice(0, 6).map((trade) => (
                        <div key={trade.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('font-semibold', trade.taker_side === 'Buy' ? 'text-emerald-400' : 'text-red-400')}>
                              {trade.taker_side}
                            </span>
                            <span className={cn('text-[10px]', trade.token_type === 'Yes' ? 'text-emerald-400' : 'text-red-400')}>
                              {trade.token_type}
                            </span>
                          </div>
                          <span className="font-mono font-semibold">{toDisplayPrice(trade.price).toFixed(1)}¢</span>
                          <span className="font-mono text-muted-foreground">{toDisplayQty(trade.quantity).toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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