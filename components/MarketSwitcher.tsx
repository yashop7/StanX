'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

interface MarketSwitcherProps {
  currentMarketId: string;
}

export const MarketSwitcher = ({ currentMarketId }: MarketSwitcherProps) => {
  const markets = useStore((state) => state.markets);
  const router = useRouter();

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume}`;
  };

  const quickAccessMarkets = markets
    .filter(m => m.id !== currentMarketId)
    .slice(0, 6);

  return (
    <div className="panel-card overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h3 className="text-lg font-semibold leading-none">Quick Access</h3>
        <p className="text-sm text-muted-foreground mt-1.5">Switch between markets</p>
      </div>

      {/* Content */}
      <div className="p-5 space-y-2">
        {quickAccessMarkets.map((market) => (
          <Button
            key={market.id}
            variant="ghost"
            className="w-full justify-start h-auto p-3 text-left hover:bg-muted/50 rounded-xl"
            onClick={() => router.push(`/market/${market.id}`)}
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="font-medium truncate text-sm leading-tight">
                {market.question}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs h-5">
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
