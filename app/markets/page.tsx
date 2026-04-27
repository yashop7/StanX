'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MarketCard } from '@/components/MarketCard';
import { MarketCardSkeleton } from '@/components/MarketCardSkeleton';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Grid3x3, LayoutList, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMarketsAction } from './actions';
import type { DisplayMarket } from '@/lib/blockchain/markets';
import { HotMarkets } from '@/components/HotMarkets';

const Markets = () => {
  const [markets, setMarkets] = useState<DisplayMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('volume');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const loadMarkets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getMarketsAction();
    if (result.success && result.markets) {
      setMarkets(result.markets);
    } else {
      setError(result.error ?? 'Failed to load markets');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const filteredMarkets = markets
    .filter(market => {
      const matchesSearch = market.question.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all'          ? true :
        statusFilter === 'live'         ? !market.isSettled && market.status === 'active' :
        statusFilter === 'ending-soon'  ? !market.isSettled && market.status === 'ending-soon' :
        statusFilter === 'settled'      ? market.isSettled :
        true;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume':      return b.volume - a.volume;
        case 'newest':      return b.endDate.getTime() - a.endDate.getTime();
        case 'ending-soon': return a.endDate.getTime() - b.endDate.getTime();
        default:            return a.marketId - b.marketId;
      }
    });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <PageTransition>
        <main className="flex-1 max-w-350 mx-auto w-full px-4 lg:px-6 py-8 pt-12">
          {/* Page Header */}
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Markets</h1>
              <p className="text-muted-foreground text-sm">
                {isLoading
                  ? 'Fetching from Solana devnet…'
                  : `${markets.length} market${markets.length !== 1 ? 's' : ''} on-chain`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMarkets}
              disabled={isLoading}
              className="gap-2 text-muted-foreground"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Hot Markets — fetches and ranks internally via server action */}
          <HotMarkets />

          {/* Search and Controls */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap mb-8">
            <div className="relative flex-1 sm:min-w-60">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search markets…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-muted/30 border-border/30 focus:border-border/60"
              />
            </div>

            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 sm:w-40 h-11 bg-muted/30 border-border/30">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Markets</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="ending-soon">Ending Soon</SelectItem>
                </SelectContent>
              </Select>


              <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg shrink-0">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className="h-9 w-9"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className="h-9 w-9"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Results count */}
          {!isLoading && !error && (
            <p className="text-sm text-muted-foreground mb-6">
              Showing {filteredMarkets.length} {filteredMarkets.length === 1 ? 'market' : 'markets'}
            </p>
          )}

          {/* Markets Grid/List */}
          {isLoading ? (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-5'
                : 'flex flex-col gap-3'
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <MarketCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredMarkets.length > 0 ? (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-5'
                : 'flex flex-col gap-3'
            )}>
              {filteredMarkets.map((market, i) => (
                <div
                  key={market.marketId}
                  className="stagger-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <MarketCard market={market} compact={viewMode === 'list'} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 rounded-2xl bg-muted/20 border border-border/30">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                {error ? 'Could not load markets' : 'No markets found on-chain yet'}
              </p>
              <Button variant="outline" onClick={() => { setSearchQuery(''); loadMarkets(); }}>
                {error ? 'Retry' : 'Clear Search'}
              </Button>
            </div>
          )}
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
};

export default Markets;
