'use client';

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
import { useStore } from '@/lib/store';
import { ArrowLeft, Share2, Bookmark, TrendingUp, Users, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const MarketDetail = () => {
  const params = useParams();
  const id = params?.id as string;
  const markets = useStore((state) => state.markets);
  const market = markets.find(m => m.id === id);

  if (!market) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Market Not Found</h2>
            <p className="text-muted-foreground mb-4">The market you're looking for doesn't exist.</p>
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

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume}`;
  };

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
          {/* Left Column - Chart & Order Book (~65-70%) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Market Header */}
            <div className="panel-card p-5">
              <div className="flex gap-4">
                {/* Small Image Thumbnail */}
                <div className="shrink-0">
                  <div className="w-14 h-14 rounded-xl overflow-hidden ring-1 ring-border/50 bg-muted">
                    <img 
                      src={market.image} 
                      alt={market.question}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Market Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5 bg-muted/80">
                      {market.category}
                    </Badge>
                    <Badge className="bg-emerald-500/15 text-emerald-500 text-[10px] font-medium px-2 py-0.5 border-0">
                      Live
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
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground/80">{market.participants.toLocaleString()}</span>
                </span>
              </div>
            </div>

            {/* Trading Chart */}
            <TradingChartRecharts data={market.priceHistory} />

            {/* Order Book - Now under the chart */}
            <OrderBook yesPrice={market.yesPrice} noPrice={market.noPrice} />

            {/* Tabs Section */}
            <Tabs defaultValue="about" className="w-full">
              <TabsList className="w-full justify-start h-10 bg-muted/20 dark:bg-muted/10 p-1 rounded-xl border border-border/20 dark:border-border/10">
                <TabsTrigger value="about" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">About</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Activity</TabsTrigger>
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
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <Card className="panel-card">
                  <CardContent className="pt-5 pb-5 space-y-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/10 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <Badge className={`text-[10px] px-2 py-0.5 ${i % 2 === 0 ? 'bg-emerald-500' : 'bg-red-500'} text-white border-0`}>
                            {i % 2 === 0 ? 'YES' : 'NO'}
                          </Badge>
                          <div className="text-xs">
                            <span className="font-medium">Bought {Math.floor(Math.random() * 100)} shares</span>
                            <span className="text-muted-foreground ml-2">{Math.floor(Math.random() * 60)}m ago</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-medium">${(Math.random() * 1000).toFixed(0)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments" className="mt-4">
                <CommentsSection />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Trade Panel (~30-35%) */}
          <div className="lg:col-span-4">
            <div className="sticky top-20 space-y-6">
              <TradingPanelNew 
                marketId={market.id}
                yesPrice={market.yesPrice}
                noPrice={market.noPrice}
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
                    <div className="text-[10px] text-muted-foreground mb-0.5">Liquidity</div>
                    <div className="text-sm font-semibold font-mono">{formatVolume(market.liquidity)}</div>
                  </div>
                  <div className="stat-box">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Traders</div>
                    <div className="text-sm font-semibold font-mono">{market.participants.toLocaleString()}</div>
                  </div>
                  <div className="stat-box">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Closes</div>
                    <div className="text-sm font-semibold font-mono">{formatDistanceToNow(market.endDate, { addSuffix: false })}</div>
                  </div>
                </div>
              </div>

              {/* Market Switcher */}
              <MarketSwitcher currentMarketId={market.id} />
            </div>
          </div>
        </div>
        </main>
      </PageTransition>
    </div>
  );
};

export default MarketDetail;