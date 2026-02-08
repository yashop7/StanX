import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Info, ArrowDownUp, Coins, Zap, Layers } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TradingPanelNewProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
}

type OrderType = 'market' | 'limit' | 'merge' | 'split';
type Side = 'buy' | 'sell';

export const TradingPanelNew = ({ marketId, yesPrice, noPrice }: TradingPanelNewProps) => {
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [side, setSide] = useState<Side>('buy');
  const [amount, setAmount] = useState<string>('');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const balance = useStore((state) => state.balance);

  const currentPrice = side === 'buy' ? yesPrice : noPrice;
  const shares = amount ? parseFloat(amount) / currentPrice : 0;
  const potentialWin = shares * 1;
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

    toast.success(`${orderType.charAt(0).toUpperCase() + orderType.slice(1)} order placed successfully!`);
    setAmount('');
    setLimitPrice('');
  };

  const orderTypes: { value: OrderType; label: string; icon: React.ReactNode }[] = [
    { value: 'market', label: 'Market', icon: <Zap className="h-3 w-3" /> },
    { value: 'limit', label: 'Limit', icon: <ArrowDownUp className="h-3 w-3" /> },
    { value: 'merge', label: 'Merge', icon: <Layers className="h-3 w-3" /> },
    { value: 'split', label: 'Split', icon: <Coins className="h-3 w-3" /> },
  ];

  return (
    <div className="panel-card overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h3 className="text-sm font-semibold text-foreground">Place Order</h3>
      </div>

      <div className="p-5 space-y-5">
        {/* Segmented Control - Pill-shaped toggle matching chart filters */}
        <div className="p-1 bg-muted/20 dark:bg-muted/10 rounded-xl border border-border/20 dark:border-border/10">
          <div className="grid grid-cols-4 gap-0.5">
            {orderTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setOrderType(type.value)}
                className={cn(
                  "relative flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11px] font-medium transition-all duration-200",
                  orderType === type.value
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground/80"
                )}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Market & Limit Order Content */}
        {(orderType === 'market' || orderType === 'limit') && (
          <>
            {/* Buy/Sell Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide('buy')}
                className={cn(
                  "relative py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden",
                  side === 'buy'
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {side === 'buy' && (
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-600/40 to-transparent" />
                )}
                <span className="relative z-10">Buy Yes</span>
              </button>
              <button
                onClick={() => setSide('sell')}
                className={cn(
                  "relative py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden",
                  side === 'sell'
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {side === 'sell' && (
                  <div className="absolute inset-0 bg-gradient-to-t from-red-600/40 to-transparent" />
                )}
                <span className="relative z-10">Buy No</span>
              </button>
            </div>

            {/* Current Price Display */}
            <div className="flex items-center justify-between p-3.5 bg-muted/20 dark:bg-muted/10 rounded-xl border border-border/20 dark:border-border/10">
              <span className="text-xs text-muted-foreground font-medium">Current Price</span>
              <span className={cn(
                "text-lg font-bold font-mono",
                side === 'buy' ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
              )}>
                {(currentPrice * 100).toFixed(1)}¢
              </span>
            </div>

            {/* Limit Price Input (only for limit orders) */}
            {orderType === 'limit' && (
              <div className="space-y-2">
                <Label htmlFor="limit-price" className="text-xs text-muted-foreground font-medium">
                  Limit Price (¢)
                </Label>
                <Input
                  id="limit-price"
                  type="number"
                  placeholder="0.00"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="h-12 bg-muted/20 dark:bg-muted/10 border-border/30 dark:border-border/20 rounded-xl font-mono text-base focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-xs text-muted-foreground font-medium">
                Amount (USD)
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 h-12 bg-muted/20 dark:bg-muted/10 border-border/30 dark:border-border/20 rounded-xl font-mono text-base focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {['10', '25', '50', '100'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    className="py-2 text-xs font-medium text-muted-foreground bg-muted/20 dark:bg-muted/10 border border-border/20 dark:border-border/10 rounded-lg hover:bg-emerald-500/20 hover:text-emerald-500 dark:hover:text-emerald-400 hover:border-emerald-500/30 transition-all duration-200"
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="space-y-2.5 p-4 bg-muted/15 dark:bg-muted/10 rounded-xl border border-border/20 dark:border-border/10">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Est. Shares</span>
                <span className="font-mono font-medium">{shares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 text-muted-foreground">
                      Potential Return
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">If {side === 'buy' ? 'YES' : 'NO'} wins, each share pays $1</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-mono font-medium text-emerald-400">${potentialWin.toFixed(2)}</span>
              </div>
              <Separator className="my-2 bg-border/20 dark:bg-border/10" />
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Profit if correct</span>
                <span className="font-mono font-semibold text-emerald-400">+${profit.toFixed(2)}</span>
              </div>
            </div>

            {/* Trade Button with Glow */}
            <button
              onClick={handleTrade}
              disabled={!amount || parseFloat(amount) <= 0}
              className={cn(
                "relative w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 overflow-hidden",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
                side === 'buy'
                  ? "bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                  : "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
              )}
            >
              <div className={cn(
                "absolute inset-0 bg-gradient-to-t to-transparent",
                side === 'buy' ? "from-emerald-600/40" : "from-red-600/40"
              )} />
              <span className="relative z-10">
                {side === 'buy' ? 'Buy Yes' : 'Buy No'} {amount && `• $${amount}`}
              </span>
            </button>
          </>
        )}

        {/* Merge Order Content */}
        {orderType === 'merge' && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/15 dark:bg-muted/10 rounded-xl border border-border/20 dark:border-border/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10">
                  <Layers className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Merge Positions</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Combine Yes + No tokens to release SOL collateral
                  </p>
                </div>
              </div>
              
              <Separator className="bg-border/20 dark:bg-border/10" />
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your Yes Tokens</span>
                  <span className="font-mono">0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your No Tokens</span>
                  <span className="font-mono">0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Mergeable</span>
                  <span className="font-mono text-amber-400">0.00</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merge-amount" className="text-xs text-muted-foreground font-medium">
                Amount to Merge
              </Label>
              <Input
                id="merge-amount"
                type="number"
                placeholder="0.00"
                className="h-12 bg-muted/20 dark:bg-muted/10 border-border/30 dark:border-border/20 rounded-xl font-mono focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>

            <button
              disabled
              className="w-full py-3.5 rounded-xl font-semibold bg-amber-500/15 text-amber-400/60 border border-amber-500/20 cursor-not-allowed"
            >
              No Tokens to Merge
            </button>
          </div>
        )}

        {/* Split Order Content */}
        {orderType === 'split' && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/15 dark:bg-muted/10 rounded-xl border border-border/20 dark:border-border/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-500/10">
                  <Coins className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Split Collateral</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Lock SOL to mint Yes + No token pairs
                  </p>
                </div>
              </div>
              
              <Separator className="bg-border/20 dark:bg-border/10" />
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collateral Rate</span>
                  <span className="font-mono">1 SOL = 1 Yes + 1 No</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your SOL Balance</span>
                  <span className="font-mono">{(balance / 150).toFixed(2)} SOL</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="split-amount" className="text-xs text-muted-foreground font-medium">
                SOL Amount to Split
              </Label>
              <Input
                id="split-amount"
                type="number"
                placeholder="0.00"
                className="h-12 bg-muted/20 dark:bg-muted/10 border-border/30 dark:border-border/20 rounded-xl font-mono focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>

            <button
              className="w-full py-3.5 rounded-xl font-semibold bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
            >
              Split SOL into Tokens
            </button>
          </div>
        )}

        <Separator className="bg-border/20 dark:bg-border/10" />

        {/* Balance */}
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Available Balance</span>
          <span className="font-mono font-medium">${balance.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};