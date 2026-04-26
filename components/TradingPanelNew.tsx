import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Info,
  ArrowDownUp,
  Coins,
  Zap,
  Layers,
  Loader2,
  AlertTriangle,
  Trophy,
  Lock,
} from "lucide-react";
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
import {
  classifyTxError,
  isUserRejection,
  extractSignature,
} from "@/lib/blockchain/verify-tx";
import { SOLANA_NETWORK, USDC_FAUCET_URL } from "@/lib/constants";

interface TradingPanelNewProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  collateralMint?: string;
  outcomeYesMint?: string;
  outcomeNoMint?: string;
  selectedTokenType?: "yes" | "no";
  onTokenTypeChange?: (value: "yes" | "no") => void;
  isSettled?: boolean;
  winningOutcome?: "YES" | "NO" | "NEITHER" | null;
  /** The market's settlement deadline — used to block new orders/splits after expiry */
  marketEndDate?: Date;
  /** True when the connected wallet is the market creator */
  isMarketCreator?: boolean;
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
  isSettled,
  winningOutcome,
  marketEndDate,
  isMarketCreator,
}: TradingPanelNewProps) => {
  const isAwaitingSettlement =
    !isSettled && !!marketEndDate && new Date() >= marketEndDate;
  const settlementPendingToast = isMarketCreator
    ? "Trading is closed. Settle the market to unlock claims."
    : "Trading is closed until the market creator settles it.";
  const awaitingSettlementTitle = isMarketCreator
    ? "Settle market"
    : "Awaiting creator settlement";
  const awaitingSettlementCaption = isMarketCreator
    ? "Trading closed. Settle to unlock payouts."
    : "Trading closed until the creator settles it.";
  const settledHeadline =
    winningOutcome === "YES"
      ? "YES won"
      : winningOutcome === "NO"
        ? "NO won"
        : winningOutcome === "NEITHER"
          ? "Settled with no winner"
          : "Market resolved";
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [tokenType, setTokenType] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [splitAmount, setSplitAmount] = useState<string>("");
  const [mergeAmount, setMergeAmount] = useState<string>("");
  const { usdcBalance, refresh: refreshCollateral } =
    useTokenBalance(collateralMint);
  const { usdcBalance: yesBalance, refresh: refreshYes } =
    useTokenBalance(outcomeYesMint);
  const { usdcBalance: noBalance, refresh: refreshNo } =
    useTokenBalance(outcomeNoMint);
  const balance = usdcBalance ?? 0;
  const tokenBalance =
    tokenType === "yes" ? (yesBalance ?? 0) : (noBalance ?? 0);
  const session = useWalletSession();
  const { send, isSending } = useSendTransaction();
  const { indexerOk } = useIndexerHealth();
  const submitting = useRef(false);
  type SendPayload = Parameters<typeof send>[0];

  useEffect(() => {
    if (selectedTokenType) {
      setTokenType(selectedTokenType);
    }
  }, [selectedTokenType]);

  useEffect(() => {
    if ((isAwaitingSettlement || isSettled) && orderType !== "merge") {
      setOrderType("merge");
    }
  }, [isAwaitingSettlement, isSettled, orderType]);

  const currentPrice = tokenType === "yes" ? yesPrice : noPrice;
  const limitPriceNum = parseFloat(limitPrice) || 0;

  const explorerUrl = (sig: string) =>
    SOLANA_NETWORK === "mainnet"
      ? `https://explorer.solana.com/tx/${sig}`
      : `https://explorer.solana.com/tx/${sig}?cluster=${SOLANA_NETWORK}`;

  const explorerAction = (sig: string) => ({
    label: "View on Explorer",
    onClick: () => window.open(explorerUrl(sig), "_blank"),
  });
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
    if (submitting.current) return;
    submitting.current = true;

    // Hoist these so they're visible in both the try and catch blocks.
    // orderStartTime MUST be set just before send() — the catch block uses it
    // to search the backend indexer for records placed around that moment.
    const numericMarketId = parseInt(marketId, 10);
    let orderStartTime = 0;

    try {
      if (isAwaitingSettlement) {
        toast.error("Order entry is closed.", {
          description: settlementPendingToast,
        });
        return;
      }

      const amountInput = parseFloat(amount);

      if (!session) {
        toast.error("Connect your wallet first.");
        return;
      }

      if (!amount || isNaN(amountInput) || amountInput <= 0) {
        toast.error("Please enter a valid amount.");
        return;
      }

      const isLimitOrder = orderType === "limit";
      const limitPriceNumForCheck = parseFloat(limitPrice) || 0;
      const usdcNeededForBuy = isLimitOrder
        ? amountInput * (limitPriceNumForCheck / 100)
        : amountInput;
      if (action === "buy" && usdcNeededForBuy > balance) {
        if (balance === 0) {
          toast.error("No USDC in your wallet.", {
            description: "You need devnet USDC to place a buy order.",
            action: {
              label: "Get free USDC →",
              onClick: () => window.open(USDC_FAUCET_URL, "_blank"),
            },
          });
        } else {
          toast.error("Insufficient USDC balance.", {
            description: `You need $${usdcNeededForBuy.toFixed(2)} but have $${balance.toLocaleString()}.`,
          });
        }
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
        const ixs = await buildLimitOrderInstruction({
          userSigner: signer,
          marketId: numericMarketId,
          tokenType: outcomeToken,
          orderSide,
          quantity: BigInt(Math.round(amountInput * PRICE_SCALE)),
          price: BigInt(Math.round(limitPriceNum * 10_000)),
        });
        orderStartTime = Math.floor(Date.now() / 1000); // capture RIGHT before send()
        const sig = await send({
          instructions: ixs as SendPayload["instructions"],
          authority: signer,
        });
        const sigStr = String(sig);
        toast.success(`Limit ${action} order placed!`, {
          description: `${amountInput.toFixed(2)} ${outcomeToken} shares @ ${limitPriceNum}¢`,
          action: explorerAction(sigStr),
        });
      } else {
        const ixs = await buildMarketOrderInstruction({
          userSigner: signer,
          marketId: numericMarketId,
          tokenType: outcomeToken,
          orderSide,
          orderAmount: BigInt(Math.round(amountInput * PRICE_SCALE)),
        });
        orderStartTime = Math.floor(Date.now() / 1000); // capture RIGHT before send()
        const sig = await send({
          instructions: ixs as SendPayload["instructions"],
          authority: signer,
        });
        const sigStr = String(sig);
        toast.success(`Market ${action} filled!`, {
          description: `${action === "buy" ? "Spent" : "Sold"} ${amountInput.toFixed(2)} ${action === "buy" ? "USDC on" : outcomeToken + " tokens for"} ${outcomeToken}`,
          action: explorerAction(sigStr),
        });
      }

      setAmount("");
      setLimitPrice("");
    } catch (err) {
      console.error("[TradingPanel] order error:", err);

      if (isUserRejection(err)) {
        toast.info("Transaction cancelled", {
          description: "You rejected the transaction in your wallet.",
        });
        return;
      }

      // Show verifying toast. Safety timer ensures it always dismisses even if
      // classifyTxError itself hangs (e.g. all fetch calls time out).
      const verifyToastId = toast.loading("Verifying order on-chain…");
      const safetyTimer = setTimeout(
        () => toast.dismiss(verifyToastId),
        20_000
      );

      try {
        const outcome = await classifyTxError(err, {
          marketId: numericMarketId,
          userPubkey: session?.account?.address ?? "",
          orderStartTime, // correctly captured before send() above
        });
        clearTimeout(safetyTimer);
        toast.dismiss(verifyToastId);

        if (outcome.kind === "success") {
          const toastOpts = outcome.signature
            ? {
                description: "Order confirmed on-chain",
                action: explorerAction(outcome.signature),
              }
            : { description: "Order confirmed via indexer" };
          toast.success(
            `${orderType === "limit" ? "Limit" : "Market"} ${action} order placed!`,
            toastOpts
          );
          setAmount("");
          setLimitPrice("");
        } else if (outcome.kind === "pending") {
          toast.warning("Transaction submitted", {
            description: outcome.hint,
            ...(outcome.signature
              ? { action: explorerAction(outcome.signature) }
              : {}),
          });
        } else if (outcome.kind === "failed") {
          toast.error("Order failed", { description: outcome.reason });
        } else {
          toast.info("Transaction cancelled");
        }
      } catch (verifyErr) {
        clearTimeout(safetyTimer);
        toast.dismiss(verifyToastId);
        console.error("[TradingPanel] verification error:", verifyErr);
        // Try to salvage a signature from the original error for the explorer link
        const salvageSig = extractSignature(err);
        toast.warning("Order status unknown", {
          description:
            "Transaction may have gone through. Check your wallet history.",
          ...(salvageSig ? { action: explorerAction(salvageSig) } : {}),
        });
      }
    } finally {
      submitting.current = false;
    }
  };

  const handleMerge = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
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
      refreshCollateral();
      refreshYes();
      refreshNo();
    } catch (err) {
      console.error("[TradingPanel] merge error:", err);
      if (isUserRejection(err)) {
        toast.info("Merge cancelled", {
          description: "You rejected the transaction in your wallet.",
        });
      } else {
        const verifyToastId = toast.loading("Verifying merge on-chain…");
        const outcome = await classifyTxError(err);
        toast.dismiss(verifyToastId);
        if (outcome.kind === "success") {
          toast.success("Tokens merged!", {
            description: outcome.signature
              ? `tx: ${outcome.signature.slice(0, 8)}…`
              : "Confirmed via indexer",
          });
          setMergeAmount("");
          refreshCollateral();
          refreshYes();
          refreshNo();
        } else if (outcome.kind === "pending") {
          toast.warning("Merge pending", {
            description: outcome.hint,
            ...(outcome.signature
              ? { action: explorerAction(outcome.signature) }
              : {}),
          });
        } else if (outcome.kind === "failed") {
          toast.error("Merge failed", { description: outcome.reason });
        } else {
          toast.info("Merge cancelled");
        }
      }
    } finally {
      submitting.current = false;
    }
  };

  const handleSplit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      if (isAwaitingSettlement) {
        toast.error("Splitting is closed.", {
          description:
            "Trading is closed. Merge stays available while settlement is pending.",
        });
        return;
      }

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
      // Refresh immediately, then again after 2 s to catch RPC propagation lag
      await Promise.all([refreshCollateral(), refreshYes(), refreshNo()]);
      setTimeout(() => {
        refreshCollateral();
        refreshYes();
        refreshNo();
      }, 2_000);
    } catch (err) {
      console.error("[TradingPanel] split error:", err);
      if (isUserRejection(err)) {
        toast.info("Split cancelled", {
          description: "You rejected the transaction in your wallet.",
        });
      } else {
        const verifyToastId = toast.loading("Verifying split on-chain…");
        let outcome;
        try {
          outcome = await classifyTxError(err);
        } catch {
          outcome = {
            kind: "failed" as const,
            reason:
              "Verification failed — check your wallet or Solana explorer.",
          };
        } finally {
          toast.dismiss(verifyToastId);
        }
        if (outcome.kind === "success") {
          toast.success("Tokens split!", {
            description: outcome.signature
              ? `tx: ${outcome.signature.slice(0, 8)}…`
              : "Confirmed on-chain",
          });
          setSplitAmount("");
          await Promise.all([refreshCollateral(), refreshYes(), refreshNo()]);
          setTimeout(() => {
            refreshCollateral();
            refreshYes();
            refreshNo();
          }, 2_000);
        } else if (outcome.kind === "pending") {
          toast.warning("Split pending", {
            description: outcome.hint,
            ...(outcome.signature
              ? { action: explorerAction(outcome.signature) }
              : {}),
          });
        } else if (outcome.kind === "failed") {
          toast.error("Split failed", { description: outcome.reason });
        } else {
          toast.info("Split cancelled");
        }
      }
    } finally {
      submitting.current = false;
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
    <div className="panel-card min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col items-start gap-2 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Place Order
          </h3>
          {isAwaitingSettlement && (
            <span
              className="rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Read-only
            </span>
          )}
          {isSettled && (
            <span
              className="rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Resolved
            </span>
          )}
        </div>
        {/* price pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-success/10 text-success">
            Y {(yesPrice * 100).toFixed(0)}¢
          </span>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-danger/10 text-danger">
            N {(noPrice * 100).toFixed(0)}¢
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* ── Market Settled banner ── */}
        {isSettled && (
          <div className="rounded-lg border border-border/40 bg-muted/15 px-3 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    winningOutcome === "YES"
                      ? "border-success/20 bg-success/10 text-success"
                      : winningOutcome === "NO"
                        ? "border-danger/20 bg-danger/10 text-danger"
                        : "border-border/40 bg-background/40 text-muted-foreground"
                  )}
                >
                  <Trophy className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
                    Resolution
                  </p>
                  <p className="text-sm font-semibold leading-tight text-foreground">
                    {settledHeadline}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">
                  Claims open
                </span>
                <span className="rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Merge available
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Active trading UI (hidden when settled, except merge) ── */}
        {!isSettled && (
          <>
            {isAwaitingSettlement && (
              <div className="rounded-lg border border-border/40 bg-muted/15 px-3 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
                        Settlement
                      </p>
                      <p className="text-sm font-semibold leading-tight text-foreground">
                        {awaitingSettlementTitle}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {awaitingSettlementCaption}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Read-only
                    </span>
                    <span className="rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">
                      Merge available
                    </span>
                    <span className="rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Payouts locked
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Indexer offline banner */}
            {!indexerOk && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>System is syncing, trading is temporarily paused</span>
              </div>
            )}

            {/* Tab bar — underline style */}
            <div className="flex gap-1 sm:flex-wrap sm:items-center sm:gap-5 sm:border-b sm:border-border">
              {orderTypes.map((type) => {
                const isDisabled =
                  isAwaitingSettlement && type.value !== "merge";
                return (
                  <button
                    key={type.value}
                    onClick={() => setOrderType(type.value)}
                    disabled={isDisabled}
                    title={
                      isDisabled
                        ? "Settlement pending — this action is closed until the market is settled."
                        : undefined
                    }
                    className={cn(
                      "flex-1 inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-[10px] font-medium transition-all duration-150 sm:flex-none sm:rounded-none sm:border-x-0 sm:border-t-0 sm:gap-1.5 sm:px-0 sm:py-2.5 sm:text-xs",
                      "disabled:cursor-not-allowed disabled:opacity-45",
                      orderType === type.value
                        ? "border-border bg-muted/30 text-foreground sm:border-foreground sm:bg-transparent"
                        : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground sm:border-transparent"
                    )}
                  >
                    <span className="hidden sm:block">{type.icon}</span>
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Market & Limit Order Content */}
            {(orderType === "market" || orderType === "limit") && (
              <>
                <fieldset
                  disabled={isAwaitingSettlement}
                  className={cn(
                    "space-y-4",
                    isAwaitingSettlement && "opacity-45"
                  )}
                >
                  {/* BUY / SELL toggle */}

                  {/* YES / NO selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setTokenType("yes");
                        onTokenTypeChange?.("yes");
                      }}
                      className={cn(
                        "py-3.5 rounded-lg border text-left px-3.5 transition-all duration-150",
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
                        "py-3.5 rounded-lg border text-left px-3.5 transition-all duration-150",
                        tokenType === "no"
                          ? "bg-danger/8 border-danger/30"
                          : "bg-muted/20 border-border hover:border-danger/20"
                      )}
                    >
                      <div
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider mb-0.5",
                          tokenType === "no"
                            ? "text-danger"
                            : "text-muted-foreground"
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
                        "flex-1 py-2.5 rounded-md text-xs font-semibold transition-all duration-150",
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
                        "flex-1 py-2.5 rounded-md text-xs font-semibold transition-all duration-150",
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
                        className="text-xs text-muted-foreground font-medium"
                      >
                        Limit Price (¢)
                      </Label>
                      <Input
                        id="limit-price"
                        type="number"
                        placeholder="50"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="h-10 bg-muted/30 border-border rounded-lg font-mono text-sm"
                      />
                    </div>
                  )}

                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label
                        htmlFor="amount"
                        className="text-xs text-muted-foreground font-medium"
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
                        onWheel={(e) => e.currentTarget.blur()}
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

                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {(isLimit
                        ? ["1", "5", "10", "25"]
                        : ["10", "25", "50", "100"]
                      ).map((val) => (
                        <button
                          key={val}
                          onClick={() => setAmount(val)}
                          className={cn(
                            "py-2.5 text-[11px] font-medium rounded-md border border-border bg-muted/30 transition-all",
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
                    <div className="flex flex-col gap-1 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-muted-foreground">
                        {action === "buy" ? "Shares" : "Shares sold"}
                      </span>
                      <span className="break-all font-mono font-medium sm:text-right">
                        {shares > 0 ? shares.toFixed(4) : "—"}{" "}
                        {tokenType.toUpperCase()}
                      </span>
                    </div>

                    {/* Row 2: USDC spent / received */}
                    <div className="flex flex-col gap-1 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-muted-foreground">
                        {action === "buy" ? "USDC spent" : "USDC received"}
                      </span>
                      <span className="break-all font-mono font-medium sm:text-right">
                        $
                        {action === "buy"
                          ? usdcCost.toFixed(2)
                          : (
                              amountNum *
                              (isLimit ? limitPriceFrac : currentPrice)
                            ).toFixed(2)}
                      </span>
                    </div>

                    {/* Row 3: max payout */}
                    <div className="flex flex-col gap-1 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
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
                      <span className="break-all font-mono font-medium sm:text-right">
                        ${potentialWin.toFixed(2)}
                      </span>
                    </div>

                    {/* Row 4: profit */}
                    <div className="flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-muted-foreground">
                        Profit if correct
                      </span>
                      <span
                        className={cn(
                          "break-all text-sm font-bold font-mono sm:text-right",
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
                    disabled={
                      isAwaitingSettlement ||
                      !indexerOk ||
                      !amount ||
                      parseFloat(amount) <= 0 ||
                      isSending
                    }
                    className={cn(
                      "w-full py-3.5 rounded-lg font-semibold text-sm text-white transition-all duration-150",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      action === "buy"
                        ? "bg-success hover:brightness-110 shadow-sm shadow-success/20"
                        : "bg-danger hover:brightness-110 shadow-sm shadow-danger/20"
                    )}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {isSending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {isSending
                        ? action === "buy"
                          ? "Buying…"
                          : "Selling…"
                        : `${action === "buy" ? "Buy" : "Sell"} ${tokenType.toUpperCase()}`}
                    </span>
                  </button>
                </fieldset>
              </>
            )}
          </>
        )}

        {/* Merge Order Content — allowed even when settled */}
        {orderType === "merge" &&
          (() => {
            const yesHeld = yesBalance ?? 0;
            const noHeld = noBalance ?? 0;
            const maxMergeable = Math.min(yesHeld, noHeld);
            const mergeAmountNum = parseFloat(mergeAmount) || 0;
            const usdcBack = mergeAmountNum; // 1 YES + 1 NO → 1 USDC
            const hasEnough =
              mergeAmountNum > 0 && mergeAmountNum <= maxMergeable;

            return (
              <div className="space-y-4">
                {/* Token balance cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={cn(
                      "py-3 rounded-lg border text-left px-3.5",
                      yesHeld > 0
                        ? "bg-success/8 border-success/30"
                        : "bg-muted/20 border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider mb-0.5",
                        yesHeld > 0 ? "text-success" : "text-muted-foreground"
                      )}
                    >
                      YES
                    </div>
                    <div className="text-sm font-bold font-mono">
                      {yesHeld > 0 ? yesHeld.toLocaleString() : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      held
                    </div>
                  </div>
                  <div
                    className={cn(
                      "py-3 rounded-lg border text-left px-3.5",
                      noHeld > 0
                        ? "bg-danger/8 border-danger/30"
                        : "bg-muted/20 border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider mb-0.5",
                        noHeld > 0 ? "text-danger" : "text-muted-foreground"
                      )}
                    >
                      NO
                    </div>
                    <div className="text-sm font-bold font-mono">
                      {noHeld > 0 ? noHeld.toLocaleString() : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      held
                    </div>
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label
                      htmlFor="merge-amount"
                      className="text-[11px] text-muted-foreground font-medium"
                    >
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
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-11 bg-muted/30 border-border rounded-lg font-mono text-sm"
                  />
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {["1", "5", "10", "25"].map((val) => (
                      <button
                        key={val}
                        onClick={() => setMergeAmount(val)}
                        className={cn(
                          "py-2.5 text-[11px] font-medium rounded-md border border-border bg-muted/30 transition-all",
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
                  <div className="flex flex-col gap-1 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">YES burned</span>
                    <span className="break-all font-mono font-medium sm:text-right">
                      {mergeAmountNum > 0
                        ? `${mergeAmountNum.toFixed(4)} YES`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">NO burned</span>
                    <span className="break-all font-mono font-medium sm:text-right">
                      {mergeAmountNum > 0
                        ? `${mergeAmountNum.toFixed(4)} NO`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-muted-foreground">
                      USDC received
                    </span>
                    <span
                      className={cn(
                        "break-all text-sm font-bold font-mono sm:text-right",
                        usdcBack > 0
                          ? "text-amber-400"
                          : "text-muted-foreground/40"
                      )}
                    >
                      {usdcBack > 0 ? `$${usdcBack.toFixed(2)}` : "—"}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={handleMerge}
                  disabled={!indexerOk || !hasEnough || isSending}
                  className={cn(
                    "w-full py-3.5 rounded-lg font-semibold text-sm text-white transition-all duration-150",
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

        {/* Split Order Content — disabled when settled or expired */}
        {!isSettled &&
          orderType === "split" &&
          (() => {
            if (isAwaitingSettlement)
              return (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-amber-500/15 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      Awaiting settlement
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Splitting is disabled. Merge stays open while settlement
                      is pending.
                    </p>
                  </div>
                </div>
              );
            const splitNum = parseFloat(splitAmount) || 0;
            const hasEnough = splitNum > 0 && splitNum <= balance;

            return (
              <div className="space-y-4">
                {/* USDC balance card */}
                <div
                  className={cn(
                    "py-3 rounded-lg border px-3.5 transition-all",
                    balance > 0
                      ? "bg-muted/20 border-border"
                      : "bg-muted/10 border-border/50"
                  )}
                >
                  <div
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider mb-1",
                      balance > 0
                        ? "text-muted-foreground"
                        : "text-muted-foreground/40"
                    )}
                  >
                    USDC
                  </div>
                  <div
                    className={cn(
                      "text-lg font-bold font-mono leading-none",
                      balance > 0
                        ? "text-foreground"
                        : "text-muted-foreground/30"
                    )}
                  >
                    {balance > 0 ? `$${balance.toLocaleString()}` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground/40 mt-1">
                    available to split
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label
                      htmlFor="split-amount"
                      className="text-[11px] text-muted-foreground font-medium"
                    >
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
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">
                      $
                    </span>
                    <Input
                      id="split-amount"
                      type="number"
                      placeholder="0.00"
                      value={splitAmount}
                      onChange={(e) => setSplitAmount(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="pl-7 h-11 bg-muted/30 border-border rounded-lg font-mono text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {["10", "25", "50", "100"].map((val) => (
                      <button
                        key={val}
                        onClick={() => setSplitAmount(val)}
                        className={cn(
                          "py-2.5 text-[11px] font-medium rounded-md border border-border bg-muted/30 transition-all",
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
                  <div className="flex flex-col gap-1 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground shrink-0">Rate</span>
                    <span className="font-mono font-medium sm:ml-2 sm:text-right">
                      1 USDC = 1 YES + 1 NO
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground shrink-0">
                      USDC locked
                    </span>
                    <span className="break-all font-mono font-medium sm:ml-2 sm:text-right">
                      {splitNum > 0 ? `$${splitNum.toFixed(2)}` : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-3.5 py-2.5">
                    <span className="text-xs text-muted-foreground">
                      You receive
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold font-mono",
                        splitNum > 0
                          ? "text-violet-400"
                          : "text-muted-foreground/40"
                      )}
                    >
                      {splitNum > 0
                        ? `${splitNum.toFixed(2)} YES + ${splitNum.toFixed(2)} NO`
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={handleSplit}
                  disabled={!indexerOk || !hasEnough || isSending}
                  className={cn(
                    "w-full py-3.5 rounded-lg font-semibold text-sm text-white transition-all duration-150",
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
