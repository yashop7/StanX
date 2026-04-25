'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DisplayMarket } from '@/lib/blockchain/markets';

interface MarketSwitcherProps {
  markets: DisplayMarket[];
  currentMarketId: string;
}

export const MarketSwitcher = ({ markets, currentMarketId }: MarketSwitcherProps) => {
  const router = useRouter();

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume}`;
  };

  const quickAccessMarkets = markets
    .filter(m => m.marketId.toString() !== currentMarketId && m.status !== 'resolved')
    .slice(0, 6);

  return (
    <div className="panel-card min-w-0 overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h3 className="text-base font-semibold leading-none sm:text-lg">Quick Access</h3>
        <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">Switch between markets</p>
      </div>

      {/* Content */}
      <div className="space-y-2 p-4 sm:p-5">
        {quickAccessMarkets.map((market) => (
          <Button
            key={market.marketId}
            variant="ghost"
            className="h-auto w-full justify-start rounded-xl p-3 text-left hover:bg-muted/50"
            onClick={() => router.push(`/market/${market.marketId}`)}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="truncate text-sm font-medium leading-tight">
                {market.question}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-5 text-xs">
                  {market.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatVolume(market.volume)}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />
          </Button>
        ))}

        <Separator className="my-4 bg-border/20 dark:bg-border/10" />

        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push('/markets')}
        >
          View All Markets
        </Button>
      </div>
    </div>
  );
};
