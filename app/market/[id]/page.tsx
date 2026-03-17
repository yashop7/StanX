'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { TradingChartRecharts } from '@/components/TradingChartRecharts';
import { TradingPanelNew } from '@/components/TradingPanelNew';
import { OrderBook } from '@/components/OrderBook';
import { MarketSwitcher } from '@/components/MarketSwitcher';
import { CommentsSection } from '@/components/CommentsSection';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Share2, Bookmark, TrendingUp, Clock, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getMarketByIdAction, getMarketsAction } from '@/app/markets/actions';
import type { DisplayMarket } from '@/lib/blockchain/markets';
import { UserStatsCard } from '@/components/UserStatsCard';

const MarketDetail = () => {
  const params = useParams();
  const rawId = params?.id as string;
  const marketId = parseInt(rawId, 10);

  const [market, setMarket] = useState<DisplayMarket | null>(null);
  const [allMarkets, setAllMarkets] = useState<DisplayMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTokenType, setSelectedTokenType] = useState<'yes' | 'no'>('yes');

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

              {/* Order Book */}
              <OrderBook
                marketId={marketIdStr}
                yesPrice={market.yesPrice}
                noPrice={market.noPrice}
                selectedTokenType={selectedTokenType}
              />

              {/* Tabs */}
              <Tabs defaultValue="about" className="w-full">
                <TabsList className="w-full justify-start h-10 bg-muted/20 dark:bg-muted/10 p-1 rounded-xl border border-border/20 dark:border-border/10">
                  <TabsTrigger value="about" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">About</TabsTrigger>
                  <TabsTrigger value="comments" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Comments</TabsTrigger>
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
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">On-chain Metadata URL</h4>
                        <p className="text-xs font-mono text-muted-foreground break-all">{market.metaDataUrl}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="comments" className="mt-4">
                  <CommentsSection />
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