import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';

interface MarketSwitcherProps {
  currentMarketId: string;
}

export const MarketSwitcher = ({ currentMarketId }: MarketSwitcherProps) => {
  const markets = useStore((state) => state.markets);
  const navigate = useNavigate();

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume}`;
  };

  const quickAccessMarkets = markets
    .filter(m => m.id !== currentMarketId)
    .slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Access</CardTitle>
        <CardDescription>Switch between markets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {quickAccessMarkets.map((market) => (
          <Button
            key={market.id}
            variant="ghost"
            className="w-full justify-start h-auto p-3 text-left hover:bg-muted"
            onClick={() => navigate(`/market/${market.id}`)}
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

        <Separator className="my-4" />

        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate('/markets')}
        >
          View All Markets
        </Button>
      </CardContent>
    </Card>
  );
};
