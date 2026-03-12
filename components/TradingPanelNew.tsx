import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Info, ArrowDownUp, Coins, Zap, Layers, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTokenBalance } from '@/hooks/use-usdc-balance';
import { useWalletSession, useSendTransaction } from '@solana/react-hooks';
import { createWalletTransactionSigner } from '@solana/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { buildLimitOrderInstruction, buildMarketOrderInstruction, buildSplitInstruction, PRICE_SCALE } from '@/lib/blockchain/market';

interface TradingPanelNewProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  collateralMint?: string;
  outcomeYesMint?: string;
  outcomeNoMint?: string;
}

type OrderType = 'market' | 'limit' | 'merge' | 'split';

export const TradingPanelNew = ({ marketId, yesPrice, noPrice, collateralMint, outcomeYesMint, outcomeNoMint }: TradingPanelNewProps) => {
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [tokenType, setTokenType] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState<string>('');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [splitAmount, setSplitAmount] = useState<string>('');
  const { usdcBalance } = useTokenBalance(collateralMint);
  const { usdcBalance: yesBalance } = useTokenBalance(outcomeYesMint);
  const { usdcBalance: noBalance } = useTokenBalance(outcomeNoMint);
  const balance = usdcBalance ?? 0;
  const tokenBalance = tokenType === 'yes' ? (yesBalance ?? 0) : (noBalance ?? 0);
  const session = useWalletSession();
  const { send, isSending } = useSendTransaction();

  const currentPrice = tokenType === 'yes' ? yesPrice : noPrice;
  const priceForCalc = orderType === 'limit' && limitPrice ? parseFloat(limitPrice) / 100 : currentPrice;
  const amountNum = parseFloat(amount) || 0;
  // Buy: amount is USDC → shares = USDC / price
  // Sell: amount is shares → USDC received = shares * price
  const shares = action === 'buy' ? (amountNum / priceForCalc) : amountNum;
  const potentialWin = action === 'buy' ? shares * 1 : amountNum * priceForCalc;
  const profit = action === 'buy' ? (potentialWin - amountNum) : (potentialWin - amountNum * priceForCalc);

  const handleTrade = async () => {
    const amountInput = parseFloat(amount);

    if (!session) {
      toast.error('Connect your wallet first.');
      return;
    }

    if (!amount || isNaN(amountInput) || amountInput <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    // For buy: check USDC balance. For sell: check token balance.
    if (action === 'buy' && amountInput > balance) {
      toast.error('Insufficient USDC balance.', {
        description: `You have $${balance.toLocaleString()} available.`,
      });
      return;
    }
    if (action === 'sell' && amountInput > tokenBalance) {
      toast.error(`Insufficient ${tokenType.toUpperCase()} token balance.`, {
        description: `You have ${tokenBalance.toLocaleString()} ${tokenType.toUpperCase()} tokens available.`,
      });
      return;
    }

    const outcomeToken = tokenType === 'yes' ? 'YES' : 'NO';
    const orderSide = action === 'buy' ? 'BUY' : 'SELL';
    const { signer } = createWalletTransactionSigner(session);
    const numericMarketId = parseInt(marketId, 10);

    try {
      if (orderType === 'limit') {
        const limitPriceNum = parseFloat(limitPrice);
        if (!limitPrice || isNaN(limitPriceNum) || limitPriceNum <= 0 || limitPriceNum > 99) {
          toast.error('Please enter a valid limit price between 1¢ and 99¢.');
          return;
        }
        // Buy: quantity = USDC / price in shares | Sell: quantity = tokens entered
        const sharesNum = action === 'buy'
          ? Math.round(amountInput / (limitPriceNum / 100))
          : Math.round(amountInput);
        const ix = await buildLimitOrderInstruction({
          userSigner: signer,
          marketId: numericMarketId,
          tokenType: outcomeToken,
          orderSide,
          quantity: BigInt(sharesNum),
          price: BigInt(Math.round(limitPriceNum * 10_000)),
        });
        const sig = await send({ instructions: [ix], authority: signer });
        toast.success(`Limit ${action} order placed!`, {
          description: `${sharesNum} ${outcomeToken} shares @ ${limitPriceNum}¢ — tx: ${String(sig).slice(0, 8)}…`,
        });
      } else {
        // Market order
        const ix = await buildMarketOrderInstruction({
          userSigner: signer,
          marketId: numericMarketId,
          tokenType: outcomeToken,
          orderSide,
          orderAmount: BigInt(Math.round(amountInput * PRICE_SCALE)),
        });
        const sig = await send({ instructions: [ix], authority: signer });
        toast.success(`Market ${action} filled!`, {
          description: `${action === 'buy' ? 'Spent' : 'Sold'} ${amountInput.toFixed(2)} ${action === 'buy' ? 'USDC on' : outcomeToken + ' tokens for'} ${outcomeToken} — tx: ${String(sig).slice(0, 8)}…`,
        });
      }

      setAmount('');
      setLimitPrice('');
    } catch (err) {
      console.error('[TradingPanel] order failed:', err);
      toast.error('Transaction failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleSplit = async () => {
    const splitAmountNum = parseFloat(splitAmount);

    if (!session) {
      toast.error('Connect your wallet first.');
      return;
    }
    if (!splitAmount || isNaN(splitAmountNum) || splitAmountNum <= 0) {
      toast.error('Please enter a valid amount to split.');
      return;
    }
    if (splitAmountNum > balance) {
      toast.error('Insufficient balance.', {
        description: `You have $${balance.toLocaleString()} available.`,
      });
      return;
    }

    const { signer } = createWalletTransactionSigner(session);
    const numericMarketId = parseInt(marketId, 10);

    try {
      const ix = await buildSplitInstruction({
        userSigner: signer,
        marketId: numericMarketId,
        // amount in micro-USDC (1 USDC = 1_000_000)
        amount: BigInt(Math.round(splitAmountNum * PRICE_SCALE)),
      });
      const sig = await send({ instructions: [ix], authority: signer });
      toast.success('Tokens split!', {
        description: `Minted ${splitAmountNum.toFixed(2)} YES + ${splitAmountNum.toFixed(2)} NO shares — tx: ${String(sig).slice(0, 8)}…`,
      });
      setSplitAmount('');
    } catch (err) {
      console.error('[TradingPanel] split failed:', err);
      toast.error('Split failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
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
            {/* Row 1: BUY / SELL */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAction('buy')}
                className={cn(
                  "relative py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden",
                  action === 'buy'
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {action === 'buy' && (
                  <div className="absolute inset-0 bg-linear-to-t from-emerald-600/40 to-transparent" />
                )}
                <span className="relative z-10">Buy</span>
              </button>
              <button
                onClick={() => setAction('sell')}
                className={cn(
                  "relative py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden",
                  action === 'sell'
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {action === 'sell' && (
                  <div className="absolute inset-0 bg-linear-to-t from-red-600/40 to-transparent" />
                )}
                <span className="relative z-10">Sell</span>
              </button>
            </div>

            {/* Row 2: YES / NO token selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTokenType('yes')}
                className={cn(
                  "py-2 rounded-xl text-xs font-semibold border transition-all duration-200",
                  tokenType === 'yes'
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                    : "bg-muted/30 text-muted-foreground border-border/20 hover:border-emerald-500/30 hover:text-emerald-400"
                )}
              >
                YES &bull; {(yesPrice * 100).toFixed(1)}¢
                {action === 'sell' && yesBalance !== null && (
                  <span className="block text-[10px] opacity-70 mt-0.5">{yesBalance.toLocaleString()} held</span>
                )}
              </button>
              <button
                onClick={() => setTokenType('no')}
                className={cn(
                  "py-2 rounded-xl text-xs font-semibold border transition-all duration-200",
                  tokenType === 'no'
                    ? "bg-red-500/15 text-red-400 border-red-500/40"
                    : "bg-muted/30 text-muted-foreground border-border/20 hover:border-red-500/30 hover:text-red-400"
                )}
              >
                NO &bull; {(noPrice * 100).toFixed(1)}¢
                {action === 'sell' && noBalance !== null && (
                  <span className="block text-[10px] opacity-70 mt-0.5">{noBalance.toLocaleString()} held</span>
                )}
              </button>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="amount" className="text-xs text-muted-foreground font-medium">
                  {action === 'buy' ? 'Amount (USDC)' : `Tokens to Sell`}
                </Label>
                {action === 'sell' && (
                  <button
                    onClick={() => setAmount(String(tokenBalance))}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Max: {tokenBalance.toLocaleString()} {tokenType.toUpperCase()}
                  </button>
                )}
              </div>
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
                <span className="text-muted-foreground">{action === 'buy' ? 'Est. Shares' : 'USDC Received'}</span>
                <span className="font-mono font-medium">{action === 'buy' ? shares.toFixed(2) : potentialWin.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 text-muted-foreground">
                      {action === 'buy' ? 'Potential Return' : 'Est. Return'}
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{action === 'buy' ? `If ${tokenType.toUpperCase()} wins, each share pays $1` : `Selling at current ${tokenType.toUpperCase()} price`}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className={cn(
                  "font-mono font-medium",
                  action === 'buy' ? "text-emerald-400" : "text-red-400"
                )}>${action === 'buy' ? potentialWin.toFixed(2) : potentialWin.toFixed(2)}</span>
              </div>
              <Separator className="my-2 bg-border/20 dark:bg-border/10" />
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">{action === 'buy' ? 'Profit if correct' : 'Gain / Loss'}</span>
                <span className={cn(
                  "font-mono font-semibold",
                  profit >= 0 ? "text-emerald-400" : "text-red-400"
                )}>{profit >= 0 ? '+' : ''}${profit.toFixed(2)}</span>
              </div>
            </div>

            {/* Trade Button with Glow */}
            <button
              onClick={handleTrade}
              disabled={!amount || parseFloat(amount) <= 0 || isSending}
              className={cn(
                "relative w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 overflow-hidden",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
                action === 'buy'
                  ? "bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                  : "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
              )}
            >
              <div className={cn(
                "absolute inset-0 bg-linear-to-t to-transparent",
                action === 'buy' ? "from-emerald-600/40" : "from-red-600/40"
              )} />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSending
                  ? (action === 'buy' ? 'Buying…' : 'Selling…')
                  : `${action === 'buy' ? 'Buy' : 'Sell'} ${tokenType.toUpperCase()}${amount ? ` • ${action === 'buy' ? '$' : ''}${amount}${action === 'sell' ? ' tokens' : ''}` : ''}`
                }
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
                    Lock USDC to mint equal Yes + No token pairs
                  </p>
                </div>
              </div>

              <Separator className="bg-border/20 dark:bg-border/10" />

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collateral Rate</span>
                  <span className="font-mono">1 USDC = 1 Yes + 1 No</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available Balance</span>
                  <span className="font-mono">${balance.toLocaleString()}</span>
                </div>
                {splitAmount && !isNaN(parseFloat(splitAmount)) && parseFloat(splitAmount) > 0 && (
                  <div className="flex justify-between text-violet-400">
                    <span>You will receive</span>
                    <span className="font-mono">{parseFloat(splitAmount).toFixed(2)} YES + {parseFloat(splitAmount).toFixed(2)} NO</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="split-amount" className="text-xs text-muted-foreground font-medium">
                USDC Amount to Split
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  id="split-amount"
                  type="number"
                  placeholder="0.00"
                  value={splitAmount}
                  onChange={(e) => setSplitAmount(e.target.value)}
                  className="pl-8 h-12 bg-muted/20 dark:bg-muted/10 border-border/30 dark:border-border/20 rounded-xl font-mono text-base focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {['10', '25', '50', '100'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setSplitAmount(val)}
                    className="py-2 text-xs font-medium text-muted-foreground bg-muted/20 dark:bg-muted/10 border border-border/20 dark:border-border/10 rounded-lg hover:bg-violet-500/20 hover:text-violet-400 hover:border-violet-500/30 transition-all duration-200"
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSplit}
              disabled={!splitAmount || parseFloat(splitAmount) <= 0 || isSending}
              className="relative w-full py-3.5 rounded-xl font-semibold text-white bg-violet-500 hover:bg-violet-400 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
            >
              <div className="absolute inset-0 bg-linear-to-t from-violet-600/40 to-transparent" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSending ? 'Splitting…' : `Split${splitAmount ? ` • $${splitAmount}` : ''}`}
              </span>
            </button>
          </div>
        )}

        <Separator className="bg-border/20 dark:bg-border/10" />

        {/* Balance */}
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            {action === 'sell' ? `${tokenType.toUpperCase()} Balance` : 'USDC Balance'}
          </span>
          <span className="font-mono font-medium">
            {action === 'sell'
              ? `${tokenBalance.toLocaleString()} ${tokenType.toUpperCase()}`
              : `$${balance.toLocaleString()}`}
          </span>
        </div>
      </div>
    </div>
  );
};