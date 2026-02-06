import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';

interface TradingPanelProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
}

export const TradingPanel = ({ marketId, yesPrice, noPrice }: TradingPanelProps) => {
  const [activeTab, setActiveTab] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState<string>('');
  const balance = useStore((state) => state.balance);
  const addPosition = useStore((state) => state.addPosition);

  const currentPrice = activeTab === 'yes' ? yesPrice : noPrice;
  const shares = amount ? parseFloat(amount) / currentPrice : 0;
  const potentialWin = shares * 1; // $1 per share at settlement
  const profit = potentialWin - (amount ? parseFloat(amount) : 0);

  const handleTrade = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > balance) {
      toast.error('Insufficient balance');
      return;
    }

    // Add position (demo)
    toast.success(`Successfully bought ${shares.toFixed(2)} ${activeTab.toUpperCase()} shares!`);
    setAmount('');
  };

  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle className="text-lg">Trade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'yes' | 'no')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="yes" className="data-[state=active]:bg-success data-[state=active]:text-success-foreground">
              <TrendingUp className="h-4 w-4 mr-2" />
              Buy YES
            </TabsTrigger>
            <TabsTrigger value="no" className="data-[state=active]:bg-danger data-[state=active]:text-danger-foreground">
              <TrendingDown className="h-4 w-4 mr-2" />
              Buy NO
            </TabsTrigger>
          </TabsList>

          <TabsContent value="yes" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-6"
                  min="0"
                  step="0.01"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                  onClick={() => setAmount(balance.toString())}
                >
                  Max
                </Button>
              </div>
            </div>

            <div className="bg-surface rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Odds</span>
                <Badge className="bg-success text-success-foreground">
                  {Math.round(yesPrice * 100)}%
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-medium">{shares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 text-muted-foreground">
                      Potential Win
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        If YES wins, each share pays $1. Your potential payout if the market resolves in your favor.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-medium">${potentialWin.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profit</span>
                <span className={`font-medium ${profit > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                  ${profit.toFixed(2)}
                </span>
              </div>
            </div>

            <Button 
              className="w-full bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleTrade}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              Buy YES Shares
            </Button>
          </TabsContent>

          <TabsContent value="no" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="amount-no">Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount-no"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-6"
                  min="0"
                  step="0.01"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                  onClick={() => setAmount(balance.toString())}
                >
                  Max
                </Button>
              </div>
            </div>

            <div className="bg-surface rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Odds</span>
                <Badge className="bg-danger text-danger-foreground">
                  {Math.round(noPrice * 100)}%
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-medium">{shares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 text-muted-foreground">
                      Potential Win
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        If NO wins, each share pays $1. Your potential payout if the market resolves in your favor.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-medium">${potentialWin.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profit</span>
                <span className={`font-medium ${profit > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                  ${profit.toFixed(2)}
                </span>
              </div>
            </div>

            <Button 
              className="w-full bg-danger hover:bg-danger/90 text-danger-foreground"
              onClick={handleTrade}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              Buy NO Shares
            </Button>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your Balance</span>
            <span className="font-medium">${balance.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
