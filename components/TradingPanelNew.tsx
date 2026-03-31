import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, ArrowDownUp, Coins, Zap, Layers, Loader2, AlertTriangle } from "lucide-react";
import { useIndexerHealth } from "@/hooks/use-indexer-health";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTokenBalance } from "@/hooks/use-usdc-balance";
import { useWalletSession, useSendTransaction } from "@solana/react-hooks";
import { createWalletTransactionSigner } from "@solana/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  buildLimitOrderInstruction,
  buildMarketOrderInstruction,
  buildSplitInstruction,
  buildMergeInstruction,
  PRICE_SCALE,
} from "@/lib/blockchain/market";

interface TradingPanelNewProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  collateralMint?: string;
  outcomeYesMint?: string;
  outcomeNoMint?: string;
  selectedTokenType?: "yes" | "no";
  onTokenTypeChange?: (value: "yes" | "no") => void;
}

type OrderType = "market" | "limit" | "merge" | "split";

export const TradingPanelNew = ({
  marketId,
  yesPrice,
  noPrice,
  collateralMint,
  outcomeYesMint,
  outcomeNoMint,
  selectedTokenType,
  onTokenTypeChange,
}: TradingPanelNewProps) => {
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [tokenType, setTokenType] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [splitAmount, setSplitAmount] = useState<string>("");
  const [mergeAmount, setMergeAmount] = useState<string>("");
  const { usdcBalance } = useTokenBalance(collateralMint);
  const { usdcBalance: yesBalance } = useTokenBalance(outcomeYesMint);
  const { usdcBalance: noBalance } = useTokenBalance(outcomeNoMint);
  const balance = usdcBalance ?? 0;
  const tokenBalance =
    tokenType === "yes" ? (yesBalance ?? 0) : (noBalance ?? 0);
  const session = useWalletSession();
  const { send, isSending } = useSendTransaction();
  const { indexerOk } = useIndexerHealth();

  useEffect(() => {
    if (selectedTokenType) {
      setTokenType(selectedTokenType);
    }
  }, [selectedTokenType]);

  const currentPrice = tokenType === "yes" ? yesPrice : noPrice;
  const limitPriceNum = parseFloat(limitPrice) || 0;
  const limitPriceFrac = limitPriceNum / 100; // cents → fraction (e.g. 50 → 0.50)
  const amountNum = parseFloat(amount) || 0;

  // ── Display calculations ──────────────────────────────────────────────────
  // Market BUY:  user enters USDC  → shares = USDC / currentPrice
  // Market SELL: user enters shares → USDC received = shares * currentPrice
  // Limit  BUY:  user enters shares directly → USDC cost = shares * limitPrice
  // Limit  SELL: user enters shares directly → USDC received = shares * limitPrice
  const isLimit = orderType === "limit";
  const shares = isLimit
    ? amountNum // limit: user enters token count
    : action === "buy"
      ? amountNum / currentPrice
      : amountNum; // market: derive from USDC
  const usdcCost = isLimit
    ? amountNum * limitPriceFrac // limit buy: cost = shares × price
    : amountNum; // market buy: cost = entered USDC
  const potentialWin = shares * 1; // winning shares pay $1 each
  const profit =
    action === "buy"
      ? potentialWin - usdcCost
      : amountNum * (isLimit ? limitPriceFrac : currentPrice) -
        amountNum * currentPrice;

  const handleTrade = async () => {
    const amountInput = parseFloat(amount);

    if (!session) {
      toast.error("Connect your wallet first.");
      return;
    }

    if (!amount || isNaN(amountInput) || amountInput <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    // For buy: check USDC balance. For sell: check token balance.
    // Limit buy: amountInput = shares, so USDC needed = shares × limitPrice
    const isLimitOrder = orderType === "limit";
    const limitPriceNumForCheck = parseFloat(limitPrice) || 0;
    const usdcNeededForBuy = isLimitOrder
      ? amountInput * (limitPriceNumForCheck / 100)
      : amountInput;
    if (action === "buy" && usdcNeededForBuy > balance) {
      toast.error("Insufficient USDC balance.", {
        description: `You need $${usdcNeededForBuy.toFixed(2)} but have $${balance.toLocaleString()}.`,
      });
      return;
    }
    if (action === "sell" && amountInput > tokenBalance) {
      toast.error(`Insufficient ${tokenType.toUpperCase()} token balance.`, {
        description: `You have ${tokenBalance.toLocaleString()} ${tokenType.toUpperCase()} tokens available.`,
      });
      return;
    }

    const outcomeToken = tokenType === "yes" ? "YES" : "NO";
    const orderSide = action === "buy" ? "BUY" : "SELL";
    const { signer } = createWalletTransactionSigner(session);
    const numericMarketId = parseInt(marketId, 10);

    console.log("limitPriceNum: ", limitPriceNum);
    try {
      if (orderType === "limit") {
        if (
          !limitPrice ||
          isNaN(limitPriceNum) ||
          limitPriceNum <= 0 ||
          limitPriceNum > 99
        ) {
          toast.error("Please enter a valid limit price between 1¢ and 99¢.");
          return;
        }
        // Program stores quantity in whole token units (e.g. 10 = 10 tokens).
        // The program handles the 6-decimal token math internally.
        // price is in micro-USDC: 50¢ → 0.5 * 1_000_000 = 500_000.
        console.log("amountInput: ", amountInput);
        console.log("limitPriceNum: ", limitPriceNum);
        const ixs = await buildLimitOrderInstruction({
          userSigner: signer,
          marketId: numericMarketId,
          tokenType: outcomeToken,
          orderSide,
          quantity: BigInt(Math.round(amountInput * PRICE_SCALE)),
          price: BigInt(Math.round(limitPriceNum * 10_000)),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sig = await send({ instructions: ixs as any[], authority: signer });
        toast.success(`Limit ${action} order placed!`, {
          description: `${amountInput.toFixed(2)} ${outcomeToken} shares @ ${limitPriceNum}¢ — tx: ${String(sig).slice(0, 8)}…`,
        });
      } else {
        // Market BUY:  amountInput is USDC dollars → send micro-USDC (× PRICE_SCALE)
        // Market SELL: amountInput is token count  → send whole token units (no scaling)
        const ixs = await buildMarketOrderInstruction({
          userSigner: signer,
          marketId: numericMarketId,
          tokenType: outcomeToken,
          orderSide,
          orderAmount:
            orderSide === "BUY"
              ? BigInt(Math.round(amountInput * PRICE_SCALE))
              : BigInt(Math.round(amountInput * PRICE_SCALE)),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sig = await send({ instructions: ixs as any[], authority: signer });
        toast.success(`Market ${action} filled!`, {
          description: `${action === "buy" ? "Spent" : "Sold"} ${amountInput.toFixed(2)} ${action === "buy" ? "USDC on" : outcomeToken + " tokens for"} ${outcomeToken} — tx: ${String(sig).slice(0, 8)}…`,
        });
      }

      setAmount("");
      setLimitPrice("");
    } catch (err) {
      console.error("[TradingPanel] order failed:", err);
      const errorWithLogs = err as {
        message?: string;
        logs?: string[];
        cause?: unknown;
      };
      const simLog =
        Array.isArray(errorWithLogs.logs) && errorWithLogs.logs.length > 0
          ? errorWithLogs.logs[errorWithLogs.logs.length - 1]
          : undefined;
      toast.error("Transaction failed", {
        description:
          simLog || (err instanceof Error ? err.message : "Unknown error"),
      });
    }
  };

  const handleMerge = async () => {
    const mergeAmountNum = parseFloat(mergeAmount);

    if (!session) {
      toast.error("Connect your wallet first.");
      return;
    }
    if (!mergeAmount || isNaN(mergeAmountNum) || mergeAmountNum <= 0) {
      toast.error("Please enter a valid amount to merge.");
      return;
    }
    const maxMergeable = Math.min(yesBalance ?? 0, noBalance ?? 0);
    if (mergeAmountNum > maxMergeable) {
      toast.error("Insufficient tokens.", {
        description: `You can merge up to ${maxMergeable.toLocaleString()} tokens.`,
      });
      return;
    }

    const { signer } = createWalletTransactionSigner(session);
    const numericMarketId = parseInt(marketId, 10);

    try {
      const ix = await buildMergeInstruction({
        userSigner: signer,
        marketId: numericMarketId,
        amount: BigInt(Math.round(mergeAmountNum * PRICE_SCALE)),
      });
      const sig = await send({ instructions: [ix], authority: signer });
      toast.success("Tokens merged!", {
        description: `Burned ${mergeAmountNum.toFixed(2)} YES + ${mergeAmountNum.toFixed(2)} NO → received ${mergeAmountNum.toFixed(2)} USDC — tx: ${String(sig).slice(0, 8)}…`,
      });
      setMergeAmount("");
    } catch (err) {
      console.error("[TradingPanel] merge failed:", err);
      toast.error("Merge failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleSplit = async () => {
    const splitAmountNum = parseFloat(splitAmount);

    if (!session) {
      toast.error("Connect your wallet first.");
      return;
    }
    if (!splitAmount || isNaN(splitAmountNum) || splitAmountNum <= 0) {
      toast.error("Please enter a valid amount to split.");
      return;
    }
    if (splitAmountNum > balance) {
      toast.error("Insufficient balance.", {
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
      toast.success("Tokens split!", {
        description: `Minted ${splitAmountNum.toFixed(2)} YES + ${splitAmountNum.toFixed(2)} NO shares — tx: ${String(sig).slice(0, 8)}…`,
      });
      setSplitAmount("");
    } catch (err) {
      console.error("[TradingPanel] split failed:", err);
      toast.error("Split failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const orderTypes: {
    value: OrderType;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { value: "market", label: "Market", icon: <Zap className="h-3 w-3" /> },
    {
      value: "limit",
      label: "Limit",
      icon: <ArrowDownUp className="h-3 w-3" />,
    },
    { value: "merge", label: "Merge", icon: <Layers className="h-3 w-3" /> },
    { value: "split", label: "Split", icon: <Coins className="h-3 w-3" /> },
  ];

  return (
    <div className="panel-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Place Order
        </h3>
        {/* price pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-success/10 text-success">
            Y {(yesPrice * 100).toFixed(0)}¢
          </span>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-danger/10 text-danger">
            N {(noPrice * 100).toFixed(0)}¢
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Indexer offline banner */}
        {!indexerOk && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>System is syncing, trading is temporarily paused</span>
          </div>
        )}

        {/* Tab bar — underline style */}
        <div className="flex border-b border-border">
          {orderTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setOrderType(type.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-150 border-b-2 -mb-px",
                orderType === type.value
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </button>
          ))}
        </div>

        {/* Market & Limit Order Content */}
        {(orderType === "market" || orderType === "limit") && (
          <>
            {/* BUY / SELL toggle */}

            {/* YES / NO selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setTokenType("yes");
                  onTokenTypeChange?.("yes");
                }}
                className={cn(
                  "py-3 rounded-lg border text-left px-3.5 transition-all duration-150",
                  tokenType === "yes"
                    ? "bg-success/8 border-success/30"
                    : "bg-muted/20 border-border hover:border-success/20"
                )}
              >
                <div
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider mb-0.5",
                    tokenType === "yes"
                      ? "text-success"
                      : "text-muted-foreground"
                  )}
                >
                  YES
                </div>
                <div className="text-sm font-bold font-mono">
                  {(yesPrice * 100).toFixed(1)}¢
                </div>
                {action === "sell" && yesBalance !== null && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {yesBalance.toLocaleString()} held
                  </div>
                )}
              </button>
              <button
                onClick={() => {
                  setTokenType("no");
                  onTokenTypeChange?.("no");
                }}
                className={cn(
                  "py-3 rounded-lg border text-left px-3.5 transition-all duration-150",
                  tokenType === "no"
                    ? "bg-danger/8 border-danger/30"
                    : "bg-muted/20 border-border hover:border-danger/20"
                )}
              >
                <div
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider mb-0.5",
                    tokenType === "no" ? "text-danger" : "text-muted-foreground"
                  )}
                >
                  NO
                </div>
                <div className="text-sm font-bold font-mono">
                  {(noPrice * 100).toFixed(1)}¢
                </div>
                {action === "sell" && noBalance !== null && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {noBalance.toLocaleString()} held
                  </div>
                )}
              </button>
            </div>

            <div className="p-1 rounded-lg bg-muted/40 border border-border flex">
              <button
                onClick={() => setAction("buy")}
                className={cn(
                  "flex-1 py-2 rounded-md text-xs font-semibold transition-all duration-150",
                  action === "buy"
                    ? "bg-success text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Buy
              </button>
              <button
                onClick={() => setAction("sell")}
                className={cn(
                  "flex-1 py-2 rounded-md text-xs font-semibold transition-all duration-150",
                  action === "sell"
                    ? "bg-danger text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sell
              </button>
            </div>

            {/* Limit Price (limit orders only) */}
            {orderType === "limit" && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="limit-price"
                  className="text-[11px] text-muted-foreground font-medium"
                >
                  Limit Price (¢)
                </Label>
                <Input
                  id="limit-price"
                  type="number"
                  placeholder="50"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="h-10 bg-muted/30 border-border rounded-lg font-mono text-sm"
                />
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="amount"
                  className="text-[11px] text-muted-foreground font-medium"
                >
                  {isLimit
                    ? action === "buy"
                      ? "Shares to buy"
                      : "Shares to sell"
                    : action === "buy"
                      ? "Amount (USDC)"
                      : "Shares to sell"}
                </Label>
                {action === "sell" && (
                  <button
                    onClick={() => setAmount(String(tokenBalance))}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  >
                    Max {tokenBalance.toLocaleString()}
                  </button>
                )}
              </div>
              <div className="relative">
                {/* Show $ prefix only for market buy (USDC input) */}
                {!isLimit && action === "buy" && (
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">
                    $
                  </span>
                )}
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={cn(
                    "h-11 bg-muted/30 border-border rounded-lg font-mono text-sm",
                    !isLimit && action === "buy" ? "pl-7" : "pl-3.5"
                  )}
                />
              </div>

              {/* For limit buy: show derived USDC cost */}
              {isLimit &&
                action === "buy" &&
                amountNum > 0 &&
                limitPriceNum > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Cost:{" "}
                    <span className="font-mono font-medium text-foreground">
                      ${usdcCost.toFixed(2)} USDC
                    </span>
                  </p>
                )}

              <div className="grid grid-cols-4 gap-1.5">
                {(isLimit
                  ? ["1", "5", "10", "25"]
                  : ["10", "25", "50", "100"]
                ).map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    className={cn(
                      "py-1.5 text-[11px] font-medium rounded-md border border-border bg-muted/30 transition-all",
                      amount === val
                        ? action === "buy"
                          ? "border-success/50 bg-success/10 text-success"
                          : "border-danger/50 bg-danger/10 text-danger"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {isLimit ? val : `$${val}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Order receipt */}
            <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border">
              {/* Row 1: shares / USDC cost */}
              <div className="flex justify-between items-center px-3.5 py-2.5 text-xs">
                <span className="text-muted-foreground">
                  {action === "buy" ? "Shares" : "Shares sold"}
                </span>
                <span className="font-mono font-medium">
                  {shares > 0 ? shares.toFixed(4) : "—"}{" "}
                  {tokenType.toUpperCase()}
                </span>
              </div>

              {/* Row 2: USDC spent / received */}
              <div className="flex justify-between items-center px-3.5 py-2.5 text-xs">
                <span className="text-muted-foreground">
                  {action === "buy" ? "USDC spent" : "USDC received"}
                </span>
                <span className="font-mono font-medium">
                  $
                  {action === "buy"
                    ? usdcCost.toFixed(2)
                    : (
                        amountNum * (isLimit ? limitPriceFrac : currentPrice)
                      ).toFixed(2)}
                </span>
              </div>

              {/* Row 3: max payout */}
              <div className="flex justify-between items-center px-3.5 py-2.5 text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 text-muted-foreground">
                      Max payout <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{`${tokenType.toUpperCase()} shares pay $1 each on correct resolution`}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-mono font-medium">
                  ${potentialWin.toFixed(2)}
                </span>
              </div>

              {/* Row 4: profit */}
              <div className="flex justify-between items-center px-3.5 py-2.5">
                <span className="text-xs text-muted-foreground">
                  Profit if correct
                </span>
                <span
                  className={cn(
                    "text-sm font-bold font-mono",
                    profit >= 0 ? "text-success" : "text-danger"
                  )}
                >
                  {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                </span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleTrade}
              disabled={!indexerOk || !amount || parseFloat(amount) <= 0 || isSending}
              className={cn(
                "w-full py-3 rounded-lg font-semibold text-sm text-white transition-all duration-150",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                action === "buy"
                  ? "bg-success hover:brightness-110 shadow-sm shadow-success/20"
                  : "bg-danger hover:brightness-110 shadow-sm shadow-danger/20"
              )}
            >
              <span className="flex items-center justify-center gap-2">
                {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSending
                  ? action === "buy"
                    ? "Buying…"
                    : "Selling…"
                  : `${action === "buy" ? "Buy" : "Sell"} ${tokenType.toUpperCase()}${amount ? ` — ${action === "buy" ? "$" + amount : amount + " tokens"}` : ""}`}
              </span>
            </button>
          </>
        )}

        {/* Merge Order Content */}
        {orderType === "merge" && (() => {
          const yesHeld = yesBalance ?? 0;
          const noHeld = noBalance ?? 0;
          const maxMergeable = Math.min(yesHeld, noHeld);
          const mergeAmountNum = parseFloat(mergeAmount) || 0;
          const usdcBack = mergeAmountNum; // 1 YES + 1 NO → 1 USDC
          const hasEnough = mergeAmountNum > 0 && mergeAmountNum <= maxMergeable;

          return (
            <div className="space-y-4">
              {/* Token balance cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className={cn(
                  "py-3 rounded-lg border text-left px-3.5",
                  yesHeld > 0 ? "bg-success/8 border-success/30" : "bg-muted/20 border-border"
                )}>
                  <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5",
                    yesHeld > 0 ? "text-success" : "text-muted-foreground"
                  )}>YES</div>
                  <div className="text-sm font-bold font-mono">{yesHeld > 0 ? yesHeld.toLocaleString() : "—"}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">held</div>
                </div>
                <div className={cn(
                  "py-3 rounded-lg border text-left px-3.5",
                  noHeld > 0 ? "bg-danger/8 border-danger/30" : "bg-muted/20 border-border"
                )}>
                  <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5",
                    noHeld > 0 ? "text-danger" : "text-muted-foreground"
                  )}>NO</div>
                  <div className="text-sm font-bold font-mono">{noHeld > 0 ? noHeld.toLocaleString() : "—"}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">held</div>
                </div>
              </div>

              {/* Amount input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="merge-amount" className="text-[11px] text-muted-foreground font-medium">
                    Pairs to Merge
                  </Label>
                  <button
                    onClick={() => setMergeAmount(String(maxMergeable))}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  >
                    Max {maxMergeable.toLocaleString()}
                  </button>
                </div>
                <Input
                  id="merge-amount"
                  type="number"
                  placeholder="0.00"
                  value={mergeAmount}
                  onChange={(e) => setMergeAmount(e.target.value)}
                  className="h-11 bg-muted/30 border-border rounded-lg font-mono text-sm"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {["1", "5", "10", "25"].map((val) => (
                    <button
                      key={val}
                      onClick={() => setMergeAmount(val)}
                      className={cn(
                        "py-1.5 text-[11px] font-medium rounded-md border border-border bg-muted/30 transition-all",
                        mergeAmount === val
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Receipt */}
              <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border">
                <div className="flex justify-between items-center px-3.5 py-2.5 text-xs">
                  <span className="text-muted-foreground">YES burned</span>
                  <span className="font-mono font-medium">
                    {mergeAmountNum > 0 ? `${mergeAmountNum.toFixed(4)} YES` : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center px-3.5 py-2.5 text-xs">
                  <span className="text-muted-foreground">NO burned</span>
                  <span className="font-mono font-medium">
                    {mergeAmountNum > 0 ? `${mergeAmountNum.toFixed(4)} NO` : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center px-3.5 py-2.5">
                  <span className="text-xs text-muted-foreground">USDC received</span>
                  <span className={cn(
                    "text-sm font-bold font-mono",
                    usdcBack > 0 ? "text-amber-400" : "text-muted-foreground/40"
                  )}>
                    {usdcBack > 0 ? `$${usdcBack.toFixed(2)}` : "—"}
                  </span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleMerge}
                disabled={!indexerOk || !hasEnough || isSending}
                className={cn(
                  "w-full py-3 rounded-lg font-semibold text-sm text-white transition-all duration-150",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20"
                )}
              >
                <span className="flex items-center justify-center gap-2">
                  {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSending
                    ? "Merging…"
                    : maxMergeable <= 0
                      ? "No Tokens to Merge"
                      : `Merge${mergeAmount ? ` ${mergeAmount} pairs` : ""}`}
                </span>
              </button>
            </div>
          );
        })()}

        {/* Split Order Content */}
        {orderType === "split" && (() => {
          const splitNum = parseFloat(splitAmount) || 0;
          const hasEnough = splitNum > 0 && splitNum <= balance;

          return (
            <div className="space-y-4">
              {/* USDC balance card */}
              <div className={cn(
                "py-3 rounded-lg border px-3.5 transition-all",
                balance > 0 ? "bg-muted/20 border-border" : "bg-muted/10 border-border/50"
              )}>
                <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", balance > 0 ? "text-muted-foreground" : "text-muted-foreground/40")}>USDC</div>
                <div className={cn("text-lg font-bold font-mono leading-none", balance > 0 ? "text-foreground" : "text-muted-foreground/30")}>
                  {balance > 0 ? `$${balance.toLocaleString()}` : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground/40 mt-1">available to split</div>
              </div>

              {/* Amount input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="split-amount" className="text-[11px] text-muted-foreground font-medium">
                    Amount (USDC)
                  </Label>
                  <button
                    onClick={() => setSplitAmount(String(balance))}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  >
                    Max ${balance.toLocaleString()}
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">$</span>
                  <Input
                    id="split-amount"
                    type="number"
                    placeholder="0.00"
                    value={splitAmount}
                    onChange={(e) => setSplitAmount(e.target.value)}
                    className="pl-7 h-11 bg-muted/30 border-border rounded-lg font-mono text-sm"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {["10", "25", "50", "100"].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSplitAmount(val)}
                      className={cn(
                        "py-1.5 text-[11px] font-medium rounded-md border border-border bg-muted/30 transition-all",
                        splitAmount === val
                          ? "border-violet-500/50 bg-violet-500/10 text-violet-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Receipt */}
              <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border">
                <div className="flex justify-between items-center px-3.5 py-2.5 text-xs">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-mono font-medium">1 USDC = 1 YES + 1 NO</span>
                </div>
                <div className="flex justify-between items-center px-3.5 py-2.5 text-xs">
                  <span className="text-muted-foreground">USDC locked</span>
                  <span className="font-mono font-medium">
                    {splitNum > 0 ? `$${splitNum.toFixed(2)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center px-3.5 py-2.5">
                  <span className="text-xs text-muted-foreground">You receive</span>
                  <span className={cn(
                    "text-sm font-bold font-mono",
                    splitNum > 0 ? "text-violet-400" : "text-muted-foreground/40"
                  )}>
                    {splitNum > 0 ? `${splitNum.toFixed(2)} YES + ${splitNum.toFixed(2)} NO` : "—"}
                  </span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleSplit}
                disabled={!indexerOk || !hasEnough || isSending}
                className={cn(
                  "w-full py-3 rounded-lg font-semibold text-sm text-white transition-all duration-150",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "bg-violet-500 hover:brightness-110 shadow-sm shadow-violet-500/20"
                )}
              >
                <span className="flex items-center justify-center gap-2">
                  {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSending
                    ? "Splitting…"
                    : `Split${splitAmount ? ` $${splitAmount}` : ""}`}
                </span>
              </button>
            </div>
          );
        })()}

        {/* Balance strip
        <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-muted/10">
          <span className="text-[11px] text-muted-foreground">
            {action === "sell"
              ? `${tokenType.toUpperCase()} balance`
              : "USDC balance"}
          </span>
          <span className="text-xs font-mono font-semibold">
            {action === "sell"
              ? `${tokenBalance.toLocaleString()} ${tokenType.toUpperCase()}`
              : `$${balance.toLocaleString()}`}
          </span>
        </div> */}
      </div>
    </div>
  );
};
