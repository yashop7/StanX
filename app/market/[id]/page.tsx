"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWalletSession, useSendTransaction } from "@solana/react-hooks";
import { createWalletTransactionSigner } from "@solana/client";
import { toast } from "sonner";
import Link from "next/link";
import { Header } from "@/components/Header";
import { FaucetBanner } from "@/components/FaucetBanner";
import { TradingChartRecharts } from "@/components/TradingChartRecharts";
import { TradingPanelNew } from "@/components/TradingPanelNew";
import { OrderBook } from "@/components/OrderBook";
import { MarketSwitcher } from "@/components/MarketSwitcher";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Share2,
  Loader2,
  AlertCircle,
  Lock,
  Trophy,
  CheckCircle2,
  XCircle,
  Activity,
  Youtube,
  ExternalLink,
} from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { formatDistanceToNow } from "date-fns";
import { useMarket, useAllMarkets } from "@/hooks/use-markets";
import { UserStatsCard } from "@/components/UserStatsCard";
import {
  buildCloseMarketInstruction,
  buildClaimRewardsInstruction,
  buildSetWinnerInstruction,
} from "@/lib/blockchain/market";
import { MarketCountdownBlocks } from "@/components/MarketCountdown";
import {
  fetchMarketTrades,
  fetchMarketResolution,
  fetchVideoPreview,
  toDisplayPrice,
  toDisplayQty,
} from "@/lib/api/backend";
import type {
  BackendTrade,
  MarketResolution,
  VideoPreview,
} from "@/lib/api/backend";
import { formatNumber } from "@/app/create-market/metadata";

import { cn } from "@/lib/utils";
import { UserMarketOrders } from "@/components/UserMarketOrders";
import { classifyTxError, isUserRejection } from "@/lib/blockchain/verify-tx";
import { OnChainOrderBook } from "@/components/OnChainOrderBook";

const MarketDetail = () => {
  const params = useParams();
  const rawId = params?.id as string;
  const marketId = parseInt(rawId, 10);

  const [selectedTokenType, setSelectedTokenType] = useState<"yes" | "no">(
    "yes"
  );
  const walletSession = useWalletSession();
  const userPubkey = walletSession?.account?.address as string | undefined;
  const { send } = useSendTransaction();
  const [actionBusy, setActionBusy] = useState<
    "close" | "claim" | "set-winner" | null
  >(null);

  const [marketTrades, setMarketTrades] = useState<BackendTrade[]>([]);
  const [resolution, setResolution] = useState<MarketResolution | null>(null);
  const [resolutionLoading, setResolutionLoading] = useState(false);
  const [liveStats, setLiveStats] = useState<VideoPreview | null>(null);

  // SWR-cached market data. Deduplicates requests (fixes the double-POST issue in dev
  // where Strict Mode would double-invoke effects), caches for 15s, revalidates on focus.
  const {
    market,
    error: marketError,
    isLoading,
    refresh: refreshMarket,
  } = useMarket(marketId);
  const { markets: allMarkets } = useAllMarkets();
  const error = isNaN(marketId)
    ? "Invalid market ID"
    : (marketError?.message ?? null);
  const load = refreshMarket;

  // Indexer-lag grace period: if market not found but ID is valid, poll for up to 15s
  // before showing a hard 404. Newly-created markets take a few seconds to be indexed.
  const [indexingDeadline, setIndexingDeadline] = useState<number | null>(null);
  const isIndexing = indexingDeadline !== null;

  useEffect(() => {
    const notFound =
      !isLoading &&
      !market &&
      !isNaN(marketId) &&
      error !== "Invalid market ID";
    if (!notFound) {
      setIndexingDeadline(null);
      return;
    }
    // Start 15s grace window on first not-found hit
    setIndexingDeadline((prev) => prev ?? Date.now() + 15_000);
  }, [isLoading, market, marketId, error]);

  useEffect(() => {
    if (!isIndexing) return;
    const interval = setInterval(() => {
      if (Date.now() >= indexingDeadline!) {
        setIndexingDeadline(null); // give up — show 404
        return;
      }
      refreshMarket();
    }, 2_000);
    return () => clearInterval(interval);
  }, [isIndexing, indexingDeadline, refreshMarket]);

  // Fetch market trades from backend
  const loadTrades = useCallback(() => {
    if (isNaN(marketId)) return;
    fetchMarketTrades(marketId, 50)
      .then(setMarketTrades)
      .catch((e) => console.warn("[Backend] trades fetch failed:", e));
  }, [marketId]);

  useEffect(() => {
    loadTrades();
    const interval = setInterval(loadTrades, 15_000);
    return () => clearInterval(interval);
  }, [loadTrades]);

  // Poll for oracle resolution data when market is past deadline and unsettled
  useEffect(() => {
    if (!market || market.isSettled) return;
    if (new Date() < market.endDate) return;

    let cancelled = false;
    const poll = async () => {
      setResolutionLoading(true);
      try {
        const res = await fetchMarketResolution(marketId);
        if (!cancelled) setResolution(res);
      } catch {
        // oracle not ready yet — will retry
      } finally {
        if (!cancelled) setResolutionLoading(false);
      }
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [market, marketId]);

  // When oracle has no result but market has a videoId, fetch live YouTube stats
  // so we can auto-determine the outcome without the creator needing to choose.
  useEffect(() => {
    if (!market || market.isSettled || resolution) return;
    if (new Date() < market.endDate) return;
    if (!market.videoId) return;

    let cancelled = false;
    fetchVideoPreview(`https://www.youtube.com/watch?v=${market.videoId}`)
      .then((stats) => {
        if (!cancelled) setLiveStats(stats);
      })
      .catch(() => {
        /* ignore — manual buttons remain visible */
      });
    return () => {
      cancelled = true;
    };
  }, [market, resolution]);

  async function handleActionError(
    err: unknown,
    messages: { success: string; failed: string; pending: string },
    onSuccess?: () => void
  ) {
    if (isUserRejection(err)) {
      toast.info("Transaction cancelled", {
        description: "You rejected the transaction in your wallet.",
      });
      return;
    }

    const verifyToastId = toast.loading("Verifying transaction on-chain…");
    try {
      const outcome = await classifyTxError(err);
      if (outcome.kind === "success") {
        toast.success(messages.success);
        onSuccess?.();
      } else if (outcome.kind === "pending") {
        toast.warning(messages.pending, { description: outcome.hint });
      } else if (outcome.kind === "failed") {
        toast.error(messages.failed, { description: outcome.reason });
      } else {
        toast.info("Transaction cancelled");
      }
    } finally {
      toast.dismiss(verifyToastId);
    }
  }

  async function handleSetWinner(outcome: "YES" | "NO" | "NEITHER") {
    if (!walletSession) {
      toast.error("Connect your wallet first.");
      return;
    }
    if (market && new Date() < market.endDate) {
      toast.error("Settlement deadline not reached", {
        description: `The market closes ${formatDistanceToNow(market.endDate, { addSuffix: true })}. You can resolve it after that.`,
      });
      return;
    }
    setActionBusy("set-winner");
    try {
      const { signer } = createWalletTransactionSigner(walletSession);
      const ix = await buildSetWinnerInstruction({
        userSigner: signer,
        marketId,
        outcome,
      });
      await send({ instructions: [ix], authority: signer });
      toast.success(
        `Market resolved — ${outcome === "NEITHER" ? "Neither" : outcome} wins!`
      );
      load();
    } catch (e) {
      await handleActionError(
        e,
        {
          success: `Market resolved — ${outcome === "NEITHER" ? "Neither" : outcome} wins!`,
          failed: "Failed to set winner",
          pending: "Resolution submitted",
        },
        load
      );
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCloseMarket() {
    if (!walletSession) {
      toast.error("Connect your wallet first.");
      return;
    }
    setActionBusy("close");
    try {
      const { signer } = createWalletTransactionSigner(walletSession);
      const ix = await buildCloseMarketInstruction({
        userSigner: signer,
        marketId,
      });
      await send({ instructions: [ix], authority: signer });
      toast.success("Market closed successfully.");
      load();
    } catch (e) {
      await handleActionError(
        e,
        {
          success: "Market closed successfully.",
          failed: "Close failed",
          pending: "Close transaction submitted",
        },
        load
      );
    } finally {
      setActionBusy(null);
    }
  }

  async function handleClaimRewards() {
    if (!walletSession) {
      toast.error("Connect your wallet first.");
      return;
    }
    setActionBusy("claim");
    try {
      const { signer } = createWalletTransactionSigner(walletSession);
      const ix = await buildClaimRewardsInstruction({
        userSigner: signer,
        marketId,
      });
      const sig = await send({ instructions: [ix], authority: signer });
      toast.success("Rewards claimed!", {
        description: `Winnings transferred to your wallet — tx: ${String(sig).slice(0, 8)}…`,
        duration: 6000,
      });
      load();
    } catch (e) {
      await handleActionError(
        e,
        {
          success: "Rewards claimed!",
          failed: "Claim failed",
          pending: "Claim transaction submitted",
        },
        load
      );
    } finally {
      setActionBusy(null);
    }
  }

  const formatVolume = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toFixed(2)}`;
  };

  const renderTradeCards = (trades: BackendTrade[]) => (
    <div className="space-y-2 sm:hidden">
      {trades.map((trade) => {
        const isBuy = trade.taker_side === "Buy";
        const isYes = trade.token_type === "Yes";
        const price = toDisplayPrice(trade.price);
        const qty = toDisplayQty(trade.quantity);
        const sAgo = Math.floor(Date.now() / 1000 - trade.event_timestamp);
        const timeStr =
          sAgo < 60
            ? `${sAgo}s`
            : sAgo < 3600
              ? `${Math.floor(sAgo / 60)}m`
              : sAgo < 86400
                ? `${Math.floor(sAgo / 3600)}h`
                : `${Math.floor(sAgo / 86400)}d`;
        return (
          <div
            key={trade.id}
            className="rounded-xl border border-border/60 bg-muted/10 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "text-[11px] font-bold leading-none",
                    isBuy ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {isBuy ? "BUY" : "SELL"}
                </span>
                <span
                  className={cn(
                    "rounded-sm px-1.5 py-[2px] text-[10px] font-semibold",
                    isYes
                      ? "bg-emerald-500/12 text-emerald-400/80"
                      : "bg-red-500/12 text-red-400/80"
                  )}
                >
                  {trade.token_type.toUpperCase()}
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground/40">
                {timeStr}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/40 bg-background/40 p-2.5">
                <div className="text-[10px] text-muted-foreground">Price</div>
                <div
                  className={cn(
                    "mt-1 font-mono text-sm font-semibold",
                    isBuy ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {price.toFixed(1)}¢
                </div>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/40 p-2.5">
                <div className="text-[10px] text-muted-foreground">Size</div>
                <div className="mt-1 font-mono text-sm text-foreground/80">
                  {qty >= 1000
                    ? `${(qty / 1000).toFixed(1)}K`
                    : qty.toFixed(qty < 10 ? 2 : 0)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading || isIndexing) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              {isIndexing
                ? `Market #${marketId} is being indexed… this takes a few seconds`
                : `Fetching market #${isNaN(marketId) ? rawId : marketId} from Solana…`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error / not found state ────────────────────────────────────────────────
  if (error || !market) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-2xl font-bold">Market Not Found</h2>
            <p className="text-muted-foreground">
              {error ?? `Market #${marketId} does not exist on-chain.`}
            </p>
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

  // ── Market found — render detail ───────────────────────────────────────────
  const marketIdStr = market.marketId.toString();
  const isMarketCreator = userPubkey?.trim() === market.authority?.trim();
  const isAwaitingSettlement =
    !market.isSettled && new Date() >= market.endDate;

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background">
      <Header />
      <FaucetBanner />

      <PageTransition>
        <main className="flex-1 container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6 md:py-8">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/markets">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Markets
            </Link>
          </Button>

          {/* Two Column Layout */}
          <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
            {/* Left Column — market banner, chart, activity, info */}
            <div className="order-1 min-w-0 space-y-5 lg:col-span-8 lg:space-y-6">
              <div className="space-y-4">
                {/* Market Header */}
                <div className="panel-card p-4 sm:p-5">
                  <div className="flex flex-row gap-3 sm:gap-4">
                    <div className="shrink-0">
                      <div className="h-12 w-12 overflow-hidden rounded-xl bg-muted ring-1 ring-border/50 sm:h-14 sm:w-14">
                        <img
                          src={market.image}
                          alt={market.question}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-muted/80 px-2 py-0.5 text-[10px] font-medium"
                        >
                          {market.category}
                        </Badge>
                        <Badge
                          className={`border-0 px-2 py-0.5 text-[10px] font-medium ${
                            market.isSettled
                              ? market.winningOutcome === "YES"
                                ? "bg-success/15 text-success"
                                : market.winningOutcome === "NO"
                                  ? "bg-danger/15 text-danger"
                                  : "bg-muted/30 text-muted-foreground"
                              : isAwaitingSettlement
                                ? "bg-amber-500/15 text-amber-400"
                                : market.status === "ending-soon"
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-emerald-500/15 text-emerald-500"
                          }`}
                        >
                          {market.isSettled
                            ? market.winningOutcome === "YES"
                              ? "YES Won"
                              : market.winningOutcome === "NO"
                                ? "NO Won"
                                : "Resolved"
                            : isAwaitingSettlement
                              ? "Awaiting Settlement"
                              : market.status === "ending-soon"
                                ? "Ending Soon"
                                : "Live"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                        >
                          #{market.marketId}
                        </Badge>
                      </div>

                      <h1 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
                        {market.question}
                      </h1>
                    </div>

                    <div className="flex shrink-0 gap-1.5 self-start sm:self-start">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        onClick={() => {
                          const url = window.location.href;
                          navigator.clipboard.writeText(url).then(() => {
                            toast.success("Link copied!", { description: url });
                          });
                        }}
                        title="Copy link"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/20 pt-4 text-xs text-muted-foreground dark:border-border/10">
                    <span className="flex items-center gap-1.5">
                      <LogoMark className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground/80">
                        {formatVolume(market.volume)}
                      </span>
                    </span>
                    {market.isSettled ? (
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          market.winningOutcome === "YES"
                            ? "text-success"
                            : market.winningOutcome === "NO"
                              ? "text-danger"
                              : "text-muted-foreground"
                        )}
                      >
                        {market.winningOutcome === "YES"
                          ? "YES wins · $1.00 per token"
                          : market.winningOutcome === "NO"
                            ? "NO wins · $1.00 per token"
                            : "Proportional return"}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground/60">
                        YES {(market.yesPrice * 100).toFixed(1)}¢ · NO{" "}
                        {(market.noPrice * 100).toFixed(1)}¢
                      </span>
                    )}
                    {market.videoId && (
                      <a
                        href={
                          market.videoUrl ??
                          `https://youtube.com/watch?v=${market.videoId}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-muted-foreground/50 transition-colors hover:text-red-400 ml-auto"
                      >
                        <Youtube className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium">
                          Watch Video
                        </span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="mt-3 flex flex-row items-center justify-between gap-3 border-t border-border/10 pt-3 dark:border-border/[0.06]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest leading-none text-muted-foreground/40">
                        {market.isSettled
                          ? "Resolved"
                          : isAwaitingSettlement
                            ? "Settlement Status"
                            : "Resolves In"}
                      </span>
                      {!market.isSettled && (
                        <span className="text-[10px] font-mono text-muted-foreground/40">
                          {market.endDate.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    <MarketCountdownBlocks
                      targetDate={market.endDate}
                      isSettled={market.isSettled}
                    />
                  </div>
                </div>

                {market.isSettled &&
                  (() => {
                    const isYes = market.winningOutcome === "YES";
                    const isNo = market.winningOutcome === "NO";
                    const isNeither = market.winningOutcome === "NEITHER";
                    return (
                      <div
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 sm:p-5",
                          isYes
                            ? "border-success/25"
                            : isNo
                              ? "border-danger/25"
                              : "border-border"
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-3.5">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                              isYes
                                ? "bg-success/10"
                                : isNo
                                  ? "bg-danger/10"
                                  : "bg-muted/30"
                            )}
                          >
                            <Trophy
                              className={cn(
                                "h-4 w-4",
                                isYes
                                  ? "text-success"
                                  : isNo
                                    ? "text-danger"
                                    : "text-muted-foreground"
                              )}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                              Market Resolved
                            </p>
                            <p
                              className={cn(
                                "break-words text-sm font-semibold sm:text-base",
                                isYes
                                  ? "text-success"
                                  : isNo
                                    ? "text-danger"
                                    : "text-foreground"
                              )}
                            >
                              {isNeither
                                ? "No winner, proportional return"
                                : `${market.winningOutcome} wins · $1.00 per token`}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold",
                            isYes
                              ? "border-success/20 bg-success/10 text-success"
                              : isNo
                                ? "border-danger/20 bg-danger/10 text-danger"
                                : "border-border bg-muted/30 text-muted-foreground"
                          )}
                        >
                          Final
                        </span>
                      </div>
                    );
                  })()}

                {!market.isSettled &&
                  isAwaitingSettlement &&
                  !isMarketCreator && (
                    <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3.5 sm:px-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background/40">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
                              Awaiting creator settlement
                            </p>
                            <p className="text-sm font-semibold leading-tight text-foreground sm:text-base">
                              Trading closed{" "}
                              {formatDistanceToNow(market.endDate, {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Read-only
                          </span>
                          <span className="rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">
                            Order book locked
                          </span>
                          <span className="rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Payouts locked
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {isMarketCreator &&
                  !market.isSettled &&
                  isAwaitingSettlement &&
                  (() => {
                    const autoOutcome: "YES" | "NO" | null = (() => {
                      if (resolution)
                        return resolution.outcome === "OutcomeA" ? "YES" : "NO";
                      if (
                        !liveStats ||
                        !market.metric ||
                        market.target === undefined
                      )
                        return null;
                      const actual =
                        market.metric === "viewCount"
                          ? liveStats.current_views
                          : market.metric === "likeCount"
                            ? liveStats.current_likes
                            : market.metric === "commentCount"
                              ? liveStats.current_comments
                              : null;
                      if (actual === null) return null;
                      return actual >= market.target ? "YES" : "NO";
                    })();

                    const actualValue = resolution
                      ? resolution.actual_value
                      : market.metric === "viewCount"
                        ? liveStats?.current_views
                        : market.metric === "likeCount"
                          ? liveStats?.current_likes
                          : market.metric === "commentCount"
                            ? liveStats?.current_comments
                            : undefined;

                    const targetValue = resolution
                      ? resolution.threshold
                      : market.target;
                    const won = autoOutcome === "YES";
                    const isLoading = resolutionLoading && !autoOutcome;

                    return (
                      <div
                        className={cn(
                          "flex flex-col items-start gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
                          autoOutcome
                            ? won
                              ? "border-success/25"
                              : "border-danger/25"
                            : "border-border"
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-3.5">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                              autoOutcome
                                ? won
                                  ? "bg-success/10"
                                  : "bg-danger/10"
                                : "bg-muted/30"
                            )}
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : autoOutcome ? (
                              won ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : (
                                <XCircle className="h-4 w-4 text-danger" />
                              )
                            ) : (
                              <Activity className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                              Ready to Resolve
                            </p>
                            {isLoading ? (
                              <p className="text-sm text-muted-foreground">
                                Fetching result…
                              </p>
                            ) : autoOutcome ? (
                              <p
                                className={cn(
                                  "break-words text-sm font-semibold",
                                  won ? "text-success" : "text-danger"
                                )}
                              >
                                {won ? "YES wins" : "NO wins"}
                                {actualValue !== undefined &&
                                  targetValue !== undefined && (
                                    <span className="ml-0 block text-xs font-normal text-muted-foreground sm:ml-2 sm:inline">
                                      {formatNumber(actualValue)} of{" "}
                                      {formatNumber(targetValue)} target
                                    </span>
                                  )}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Deadline passed — settle manually
                              </p>
                            )}
                          </div>
                        </div>

                        {autoOutcome ? (
                          <button
                            disabled={actionBusy !== null}
                            onClick={() => handleSetWinner(autoOutcome)}
                            className={cn(
                              "flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:w-auto",
                              "disabled:cursor-not-allowed disabled:opacity-40",
                              won
                                ? "border border-success/30 bg-success/15 text-success hover:bg-success/25"
                                : "border border-danger/30 bg-danger/15 text-danger hover:bg-danger/25"
                            )}
                          >
                            {actionBusy === "set-winner" ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                                Settling…
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Settle
                                Market
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                            {(["YES", "NO", "NEITHER"] as const).map((o) => (
                              <button
                                key={o}
                                disabled={actionBusy !== null}
                                onClick={() => handleSetWinner(o)}
                                className={cn(
                                  "flex-1 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all disabled:opacity-40 sm:flex-none",
                                  o === "YES"
                                    ? "border-success/30 bg-success/10 text-success hover:bg-success/20"
                                    : o === "NO"
                                      ? "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                                )}
                              >
                                {actionBusy === "set-winner" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : o === "NEITHER" ? (
                                  "Neither"
                                ) : (
                                  o
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>

              {/* Trading Chart */}
              <TradingChartRecharts
                marketId={marketId}
                token={selectedTokenType}
                volume={market.volume}
              />

              {/* ── Market Activity ─────────────────────────────────── */}
              <div className="panel-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/10 dark:border-border/[0.08]">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {market.isSettled ? "Trade History" : "Market Activity"}
                  </h3>
                  {!market.isSettled &&
                    (isAwaitingSettlement ? (
                      <span className="flex items-center gap-1.5 text-[10px] text-amber-400/80 font-medium">
                        <Lock className="h-3 w-3" />
                        Awaiting settlement
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[10px] text-emerald-500/70 font-medium">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                      </span>
                    ))}
                </div>

                {market.isSettled ? (
                  /* Settled — no order book, just trade history with a closed notice */
                  <>
                    <div className="flex items-start gap-3 px-4 py-3 border-b border-border/[0.06] bg-muted/10">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      <p className="text-xs text-muted-foreground/60">
                        Trading is closed. You can still merge YES and NO token
                        pairs back to USDC.
                      </p>
                    </div>
                    {marketTrades.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <p className="text-sm text-muted-foreground/50">
                          No trades recorded
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const maxQty = Math.max(
                          ...marketTrades.map((t) => t.quantity)
                        );
                        return (
                          <>
                            {renderTradeCards(marketTrades)}
                            <div className="hidden overflow-x-auto scrollbar-thin sm:block">
                              <div className="min-w-[320px]">
                                <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2 border-b border-border/[0.08] text-[9px] font-semibold text-muted-foreground/35 uppercase tracking-[0.12em]">
                                  <span>Trade</span>
                                  <span className="text-right pr-8">Price</span>
                                  <span className="text-right w-20 pr-3">
                                    Size
                                  </span>
                                  <span className="text-right w-10">When</span>
                                </div>
                                <div className="max-h-[24rem] overflow-y-auto scrollbar-thin divide-y divide-border/[0.06]">
                                  {marketTrades.map((trade) => {
                                    const isBuy = trade.taker_side === "Buy";
                                    const isYes = trade.token_type === "Yes";
                                    const depthPct =
                                      (trade.quantity / maxQty) * 48;
                                    const price = toDisplayPrice(trade.price);
                                    const qty = toDisplayQty(trade.quantity);
                                    const sAgo = Math.floor(
                                      Date.now() / 1000 - trade.event_timestamp
                                    );
                                    const timeStr =
                                      sAgo < 60
                                        ? `${sAgo}s`
                                        : sAgo < 3600
                                          ? `${Math.floor(sAgo / 60)}m`
                                          : sAgo < 86400
                                            ? `${Math.floor(sAgo / 3600)}h`
                                            : `${Math.floor(sAgo / 86400)}d`;
                                    return (
                                      <div
                                        key={trade.id}
                                        className="relative grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-[9px] hover:bg-muted/[0.03] transition-colors group"
                                      >
                                        <div
                                          className={cn(
                                            "absolute right-0 inset-y-0 pointer-events-none",
                                            isBuy
                                              ? "bg-emerald-500/[0.04]"
                                              : "bg-red-500/[0.04]"
                                          )}
                                          style={{
                                            width: `${depthPct * 0.6}%`,
                                          }}
                                        />
                                        <div
                                          className={cn(
                                            "absolute left-0 top-[18%] bottom-[18%] w-[2px] rounded-r-full",
                                            isBuy
                                              ? "bg-emerald-500/50"
                                              : "bg-red-500/50"
                                          )}
                                        />
                                        <div className="flex items-center gap-2 z-10">
                                          <span
                                            className={cn(
                                              "text-[11px] font-bold leading-none",
                                              isBuy
                                                ? "text-emerald-400"
                                                : "text-red-400"
                                            )}
                                          >
                                            {isBuy ? "BUY" : "SELL"}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-[9px] font-semibold px-1.5 py-[2px] rounded-sm",
                                              isYes
                                                ? "bg-emerald-500/12 text-emerald-400/80"
                                                : "bg-red-500/12 text-red-400/80"
                                            )}
                                          >
                                            {trade.token_type.toUpperCase()}
                                          </span>
                                        </div>
                                        <div className="text-right pr-8 z-10">
                                          <span
                                            className={cn(
                                              "font-mono font-semibold text-[13px] tabular-nums",
                                              isBuy
                                                ? "text-emerald-400"
                                                : "text-red-400"
                                            )}
                                          >
                                            {price.toFixed(1)}
                                            <span className="text-[10px] font-normal opacity-50">
                                              ¢
                                            </span>
                                          </span>
                                        </div>
                                        <div className="text-right w-20 pr-3 z-10">
                                          <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">
                                            {qty >= 1000
                                              ? `${(qty / 1000).toFixed(1)}K`
                                              : qty.toFixed(qty < 10 ? 2 : 0)}
                                          </span>
                                        </div>
                                        <div className="text-right w-10 z-10">
                                          <span className="font-mono text-[10px] text-muted-foreground/30 tabular-nums">
                                            {timeStr}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="px-4 py-2.5 border-t border-border/[0.08]">
                              <span className="text-[10px] text-muted-foreground/35 tabular-nums">
                                {marketTrades.length} executions
                              </span>
                            </div>
                          </>
                        );
                      })()
                    )}
                  </>
                ) : (
                  /* Live — full order book + live trades tabs */
                  <Tabs defaultValue="orderbook" className="w-full">
                    <div className="px-4 pb-0 pt-3">
                      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg border border-border/15 bg-muted/20 p-1 dark:border-border/[0.08] dark:bg-muted/[0.08]">
                        <TabsTrigger
                          value="orderbook"
                          className="h-8 px-3 text-[11px] font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                          Order Book
                        </TabsTrigger>
                        <TabsTrigger
                          value="trades"
                          className="h-8 px-3 text-[11px] font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                          {isAwaitingSettlement
                            ? "Recent Trades"
                            : "Live Trades"}
                          {marketTrades.length > 0 && (
                            <span className="ml-1.5 text-[9px] px-1.5 py-[1px] rounded-full bg-emerald-500/15 text-emerald-400 font-bold tabular-nums">
                              {marketTrades.length}
                            </span>
                          )}
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent
                      value="orderbook"
                      className="mt-0 space-y-4 p-3 sm:p-4"
                    >
                      <OrderBook
                        marketId={marketIdStr}
                        yesPrice={market.yesPrice}
                        noPrice={market.noPrice}
                        selectedTokenType={selectedTokenType}
                        userPubkey={userPubkey}
                        isTradingClosed={isAwaitingSettlement}
                        isMarketCreator={isMarketCreator}
                      />
                      {/* <div className="flex items-center gap-3 pt-2">
                        <div className="flex-1 h-px bg-violet-500/15" />
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-violet-400/50 whitespace-nowrap">On-Chain (Debug)</span>
                        <div className="flex-1 h-px bg-violet-500/15" />
                      </div>
                      <OnChainOrderBook marketId={marketIdStr} yesPrice={market.yesPrice} noPrice={market.noPrice} selectedTokenType={selectedTokenType} userPubkey={userPubkey} /> */}
                    </TabsContent>
                    <TabsContent value="trades" className="mt-0">
                      {marketTrades.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-muted-foreground/30" />
                          </div>
                          <p className="text-sm text-muted-foreground/60">
                            {isAwaitingSettlement
                              ? "No trades were matched before trading closed"
                              : "No trades yet"}
                          </p>
                          <p className="text-xs text-muted-foreground/35">
                            {isAwaitingSettlement
                              ? "The order book stays locked until the creator settles this market"
                              : "Trades appear here when the order book matches"}
                          </p>
                        </div>
                      ) : (
                        (() => {
                          const maxQty = Math.max(
                            ...marketTrades.map((t) => t.quantity)
                          );
                          return (
                            <>
                              {renderTradeCards(marketTrades)}
                              <div className="hidden overflow-x-auto scrollbar-thin sm:block">
                                <div className="min-w-[320px]">
                                  <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2 border-b border-border/[0.08] text-[9px] font-semibold text-muted-foreground/35 uppercase tracking-[0.12em]">
                                    <span>Trade</span>
                                    <span className="text-right pr-8">
                                      Price
                                    </span>
                                    <span className="text-right w-20 pr-3">
                                      Size
                                    </span>
                                    <span className="text-right w-10">
                                      When
                                    </span>
                                  </div>
                                  <div className="max-h-[30rem] overflow-y-auto divide-y divide-border/[0.06] scrollbar-thin">
                                    {marketTrades.map((trade) => {
                                      const isBuy = trade.taker_side === "Buy";
                                      const isYes = trade.token_type === "Yes";
                                      const depthPct =
                                        (trade.quantity / maxQty) * 48;
                                      const price = toDisplayPrice(trade.price);
                                      const qty = toDisplayQty(trade.quantity);
                                      const sAgo = Math.floor(
                                        Date.now() / 1000 -
                                          trade.event_timestamp
                                      );
                                      const timeStr =
                                        sAgo < 60
                                          ? `${sAgo}s`
                                          : sAgo < 3600
                                            ? `${Math.floor(sAgo / 60)}m`
                                            : sAgo < 86400
                                              ? `${Math.floor(sAgo / 3600)}h`
                                              : `${Math.floor(sAgo / 86400)}d`;
                                      return (
                                        <div
                                          key={trade.id}
                                          className="relative grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-[9px] hover:bg-muted/[0.03] transition-colors group"
                                        >
                                          <div
                                            className={cn(
                                              "absolute right-0 inset-y-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity",
                                              isBuy
                                                ? "bg-emerald-500/[0.06]"
                                                : "bg-red-500/[0.06]"
                                            )}
                                            style={{ width: `${depthPct}%` }}
                                          />
                                          <div
                                            className={cn(
                                              "absolute right-0 inset-y-0 pointer-events-none",
                                              isBuy
                                                ? "bg-emerald-500/[0.04]"
                                                : "bg-red-500/[0.04]"
                                            )}
                                            style={{
                                              width: `${depthPct * 0.6}%`,
                                            }}
                                          />
                                          <div
                                            className={cn(
                                              "absolute left-0 top-[18%] bottom-[18%] w-[2px] rounded-r-full",
                                              isBuy
                                                ? "bg-emerald-500/50"
                                                : "bg-red-500/50"
                                            )}
                                          />
                                          <div className="flex items-center gap-2 z-10 min-w-0">
                                            <span
                                              className={cn(
                                                "text-[11px] font-bold leading-none shrink-0",
                                                isBuy
                                                  ? "text-emerald-400"
                                                  : "text-red-400"
                                              )}
                                            >
                                              {isBuy ? "BUY" : "SELL"}
                                            </span>
                                            <span
                                              className={cn(
                                                "text-[9px] font-semibold px-1.5 py-[2px] rounded-sm leading-none shrink-0",
                                                isYes
                                                  ? "bg-emerald-500/12 text-emerald-400/80"
                                                  : "bg-red-500/12 text-red-400/80"
                                              )}
                                            >
                                              {trade.token_type.toUpperCase()}
                                            </span>
                                          </div>
                                          <div className="text-right pr-8 z-10">
                                            <span
                                              className={cn(
                                                "font-mono font-semibold text-[13px] tabular-nums",
                                                isBuy
                                                  ? "text-emerald-400"
                                                  : "text-red-400"
                                              )}
                                            >
                                              {price.toFixed(1)}
                                              <span className="text-[10px] font-normal opacity-50">
                                                ¢
                                              </span>
                                            </span>
                                          </div>
                                          <div className="text-right w-20 pr-3 z-10">
                                            <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">
                                              {qty >= 1000
                                                ? `${(qty / 1000).toFixed(1)}K`
                                                : qty.toFixed(qty < 10 ? 2 : 0)}
                                            </span>
                                          </div>
                                          <div className="text-right w-10 z-10">
                                            <span className="font-mono text-[10px] text-muted-foreground/30 tabular-nums">
                                              {timeStr}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-start gap-1.5 px-4 py-2.5 border-t border-border/[0.08] sm:flex-row sm:items-center sm:justify-between">
                                <span className="text-[10px] text-muted-foreground/35 tabular-nums">
                                  {marketTrades.length} executions
                                </span>
                                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/35">
                                  <span className="inline-block h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                                  refreshes every 15s
                                </span>
                              </div>
                            </>
                          );
                        })()
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </div>

              {/* ── Info — About + My Orders ────────────────────────────── */}
              <Tabs defaultValue="about" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg border border-border/15 bg-muted/20 p-1 dark:border-border/8 dark:bg-muted/8">
                  <TabsTrigger
                    value="about"
                    className="h-8 px-3 text-[11px] font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    About
                  </TabsTrigger>
                  <TabsTrigger
                    value="my-orders"
                    className="h-8 px-3 text-[11px] font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    My Orders
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="about" className="space-y-4 mt-4">
                  <Card className="panel-card">
                    <CardContent className="pt-5 pb-5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Description
                      </h4>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {market.description}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="panel-card">
                    <CardContent className="pt-5 pb-5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Resolution Criteria
                      </h4>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {market.resolutionCriteria}
                      </p>
                    </CardContent>
                  </Card>
                  {market.metaDataUrl && (
                    <Card className="panel-card">
                      <CardContent className="pt-5 pb-5">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          On-chain Metadata
                        </h4>
                        <a
                          href={market.metaDataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-mono text-primary hover:underline break-all"
                        >
                          {market.metaDataUrl}
                        </a>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="my-orders" className="mt-4">
                  <Card className="panel-card">
                    <CardContent className="pt-5 pb-5">
                      <UserMarketOrders
                        marketId={marketId}
                        userPubkey={userPubkey}
                        isSettled={market.isSettled}
                        marketEndDate={market.endDate}
                        isMarketCreator={isMarketCreator}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column — trading panel */}
            <div className="order-2 min-w-0 lg:col-span-4">
              <div className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:space-y-6">
                <TradingPanelNew
                  marketId={marketIdStr}
                  yesPrice={market.yesPrice}
                  noPrice={market.noPrice}
                  collateralMint={market.collateralMint}
                  outcomeYesMint={market.outcomeYesMint}
                  outcomeNoMint={market.outcomeNoMint}
                  selectedTokenType={selectedTokenType}
                  onTokenTypeChange={setSelectedTokenType}
                  isSettled={market.isSettled}
                  winningOutcome={market.winningOutcome}
                  marketEndDate={market.endDate}
                  isMarketCreator={isMarketCreator}
                />

                {/* User Position Stats */}
                <UserStatsCard
                  marketId={market.marketId}
                  outcomeYesMint={market.outcomeYesMint}
                  outcomeNoMint={market.outcomeNoMint}
                  isSettled={market.isSettled}
                  winningOutcome={market.winningOutcome}
                />

                {/* ── Creator Actions Panel — Close Market only ───────── */}
                {isMarketCreator && market.isSettled && (
                    <div className="panel-card space-y-3 p-4 sm:p-5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Creator Actions
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Permanently closes the market account and reclaims rent.
                        Requires all orders cancelled and all rewards claimed.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 border-border/40 text-muted-foreground hover:text-foreground"
                        disabled={actionBusy !== null}
                        onClick={handleCloseMarket}
                      >
                        {actionBusy === "close" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                        {actionBusy === "close" ? "Closing..." : "Close Market"}
                      </Button>
                    </div>
                  )}

                {/* ── Claim Rewards — any user when winner is set ──────── */}
                {market.isSettled &&
                  market.winningOutcome &&
                  market.winningOutcome !== "NEITHER" && (
                    <div className="panel-card space-y-3 p-4 sm:p-5">
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Trophy className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs text-emerald-400 font-semibold">
                          {market.winningOutcome === "YES" ? "YES" : "NO"} wins
                          — claim your rewards
                        </span>
                      </div>
                      <Button
                        className="w-full gap-2 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-400"
                        disabled={actionBusy !== null}
                        onClick={handleClaimRewards}
                      >
                        {actionBusy === "claim" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trophy className="h-4 w-4" />
                        )}
                        {actionBusy === "claim" ? "Claiming…" : "Claim Rewards"}
                      </Button>
                    </div>
                  )}

                {/* Market Info */}
                <div className="panel-card space-y-4 p-4 sm:p-5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Market Info
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="stat-box">
                      <div className="text-[10px] text-muted-foreground mb-0.5">
                        Volume
                      </div>
                      <div className="text-sm font-semibold font-mono">
                        {formatVolume(market.volume)}
                      </div>
                    </div>
                    <div className="stat-box">
                      <div className="text-[10px] text-muted-foreground mb-0.5">
                        Market ID
                      </div>
                      <div className="text-sm font-semibold font-mono">
                        #{market.marketId}
                      </div>
                    </div>
                    <div className="stat-box">
                      <div className="text-[10px] text-muted-foreground mb-0.5">
                        {isAwaitingSettlement ? "Deadline" : "Closes"}
                      </div>
                      <div className="text-sm font-semibold font-mono">
                        {formatDistanceToNow(market.endDate, {
                          addSuffix: isAwaitingSettlement,
                        })}
                      </div>
                    </div>
                    <div className="stat-box">
                      <div className="text-[10px] text-muted-foreground mb-0.5">
                        Status
                      </div>
                      <div className="text-sm font-semibold font-mono capitalize">
                        {isAwaitingSettlement
                          ? "awaiting settlement"
                          : market.status}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Market Switcher */}
                <MarketSwitcher
                  markets={allMarkets}
                  currentMarketId={marketIdStr}
                />
              </div>
            </div>
          </div>
        </main>
      </PageTransition>
    </div>
  );
};

export default MarketDetail;
