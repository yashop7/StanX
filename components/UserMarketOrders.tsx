"use client";

import { useState, useEffect, useRef } from "react";
import {
  fetchUserMarketOrders,
  toDisplayPrice,
  toDisplayQty,
} from "@/lib/api/backend";
import type { BackendOrder } from "@/lib/api/backend";
import { Loader2, RefreshCw, AlertCircle, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWalletSession, useSendTransaction } from "@solana/react-hooks";
import { createWalletTransactionSigner } from "@solana/client";
import { buildCancelOrderInstruction } from "@/lib/blockchain/market";
import { toast } from "sonner";
import { useIndexerHealth } from "@/hooks/use-indexer-health";
import { classifyTxError, isUserRejection } from "@/lib/blockchain/verify-tx";

interface Props {
  marketId: number;
  userPubkey: string | undefined;
  isSettled?: boolean;
  marketEndDate?: Date;
  isMarketCreator?: boolean;
}

function fmtQty(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? String(n) : n.toFixed(4);
}

const CANCELLABLE = new Set(["Open", "PartiallyFilled"]);

export function UserMarketOrders({
  marketId,
  userPubkey,
  isSettled,
  marketEndDate,
  isMarketCreator = false,
}: Props) {
  const [orders, setOrders] = useState<BackendOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<bigint | null>(null);
  // Track previous statuses to detect fills between polls
  const prevStatusRef = useRef<Map<number, BackendOrder["status"]>>(new Map());

  const session = useWalletSession();
  const { send } = useSendTransaction();
  const { indexerOk } = useIndexerHealth();
  const isCancellationClosed =
    !isSettled && !!marketEndDate && new Date() >= marketEndDate;
  const cancellationClosedDescription = isMarketCreator
    ? "Trading is over and your open orders stay frozen until you settle this market."
    : "Your open orders stay frozen because the market creator has not settled this market yet.";

  async function load() {
    if (!userPubkey) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserMarketOrders(marketId, userPubkey);

      // Notify on status changes detected since the last poll
      const prev = prevStatusRef.current;
      if (prev.size > 0) {
        for (const order of data) {
          const prevStatus = prev.get(order.order_id);
          if (prevStatus && prevStatus !== order.status) {
            if (order.status === "Filled") {
              toast.success(`Order #${order.order_id} filled`, {
                description: `${order.side} ${order.token_type} @ ${toDisplayPrice(order.price).toFixed(1)}¢`,
              });
            } else if (
              order.status === "PartiallyFilled" &&
              prevStatus === "Open"
            ) {
              toast(`Order #${order.order_id} partially filled`, {
                description: `${order.side} ${order.token_type} — ${toDisplayQty(order.remaining_quantity).toFixed(2)} remaining`,
              });
            }
          }
        }
      }
      // Update the snapshot
      prevStatusRef.current = new Map(data.map((o) => [o.order_id, o.status]));

      setOrders(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, userPubkey]);

  async function handleCancel(order: BackendOrder) {
    if (!session) {
      toast.error("Connect your wallet to cancel orders.");
      return;
    }
    if (isCancellationClosed) {
      toast.error("Order cancellations are closed.", {
        description: `${cancellationClosedDescription} They can't be cancelled until settlement is posted.`,
      });
      return;
    }

    const orderId = BigInt(order.order_id);
    setCancelling(orderId);
    try {
      const { signer } = createWalletTransactionSigner(session);
      const ix = await buildCancelOrderInstruction({
        userSigner: signer,
        marketId,
        orderId,
        orderSide: order.side === "Buy" ? "BUY" : "SELL",
        tokenType: order.token_type === "Yes" ? "YES" : "NO",
      });
      await send({ instructions: [ix], authority: signer });
      toast.success(`Order #${order.order_id} cancelled`);
      // Refresh after short delay so backend has time to index
      setTimeout(load, 2000);
    } catch (e) {
      if (isUserRejection(e)) {
        toast.info("Transaction cancelled", {
          description: "You rejected the transaction in your wallet.",
        });
        return;
      }

      const verifyToastId = toast.loading("Verifying cancellation on-chain…");
      try {
        const outcome = await classifyTxError(e);
        if (outcome.kind === "success") {
          toast.success(`Order #${order.order_id} cancelled`);
          setTimeout(load, 2000);
        } else if (outcome.kind === "pending") {
          toast.warning("Cancel transaction submitted", {
            description: outcome.hint,
          });
        } else if (outcome.kind === "failed") {
          toast.error("Cancel failed", { description: outcome.reason });
        } else {
          toast.info("Transaction cancelled");
        }
      } finally {
        toast.dismiss(verifyToastId);
      }
    } finally {
      setCancelling(null);
    }
  }

  if (!userPubkey) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Connect your wallet to see your orders.
      </p>
    );
  }

  const ordersList = orders ?? [];

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            My Orders
          </p>
          {isCancellationClosed && (
            <span className="rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Locked
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          className="h-6 px-2 text-[10px] text-muted-foreground gap-1"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isCancellationClosed && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="font-medium text-foreground/85">
            Cancellations locked
          </span>
          <span>Until settlement is posted.</span>
        </div>
      )}

      {loading && orders === null && (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading orders…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && orders !== null && orders.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No orders found in this market.
        </p>
      )}

      {ordersList.length > 0 && (
        <>
          <div className="space-y-2 sm:hidden">
            {ordersList.map((order) => {
              const oid = BigInt(order.order_id);
              const isCancelling = cancelling === oid;
              const canCancel = CANCELLABLE.has(order.status);
              const cancelDisabled =
                isCancelling || !indexerOk || isCancellationClosed;
              const cancelTitle = isCancellationClosed
                ? isMarketCreator
                  ? "Settlement pending — your order stays locked until you settle this market"
                  : "Settlement pending — this order stays locked until the creator settles the market"
                : !indexerOk
                  ? "Trading paused — indexer syncing"
                  : "Cancel order";
              return (
                <div
                  key={order.order_id}
                  className="rounded-xl border border-border/60 bg-muted/10 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            order.side === "Buy"
                              ? "text-emerald-400"
                              : "text-red-400"
                          )}
                        >
                          {order.side}
                        </span>
                        <span
                          className={cn(
                            "rounded-sm px-1.5 py-[2px] text-[10px] font-semibold",
                            order.token_type === "Yes"
                              ? "bg-emerald-500/12 text-emerald-400/80"
                              : "bg-red-500/12 text-red-400/80"
                          )}
                        >
                          {order.token_type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Order #{order.order_id}
                      </p>
                    </div>
                    {canCancel && (
                      <button
                        onClick={() => handleCancel(order)}
                        disabled={cancelDisabled}
                        title={cancelTitle}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                      >
                        {isCancelling ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isCancellationClosed ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-border/40 bg-background/40 p-2.5">
                      <div className="text-[10px] text-muted-foreground">
                        Price
                      </div>
                      <div className="mt-1 font-mono font-semibold">
                        {toDisplayPrice(order.price).toFixed(1)}¢
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-background/40 p-2.5">
                      <div className="text-[10px] text-muted-foreground">
                        Status
                      </div>
                      <div
                        className={cn(
                          "mt-1 font-semibold",
                          order.status === "Open"
                            ? "text-emerald-400"
                            : order.status === "PartiallyFilled"
                              ? "text-amber-400"
                              : order.status === "Filled"
                                ? "text-blue-400"
                                : "text-muted-foreground"
                        )}
                      >
                        {order.status === "PartiallyFilled"
                          ? "Partial"
                          : order.status}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-background/40 p-2.5 col-span-2">
                      <div className="text-[10px] text-muted-foreground">
                        Remaining
                      </div>
                      <div className="mt-1 font-mono text-sm">
                        {fmtQty(toDisplayQty(order.remaining_quantity))}
                        <span className="text-muted-foreground/40">
                          {" "}
                          / {fmtQty(toDisplayQty(order.original_quantity))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto scrollbar-thin sm:block">
            <div className="min-w-[340px]">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1fr_64px_72px_72px_40px] border-b border-border/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Side</span>
                <span>Token</span>
                <span className="text-right">Price</span>
                <span className="text-right">Remaining</span>
                <span className="text-right">Status</span>
                <span />
              </div>

              <div className="space-y-0.5">
                {ordersList.map((order) => {
                  const oid = BigInt(order.order_id);
                  const isCancelling = cancelling === oid;
                  const canCancel = CANCELLABLE.has(order.status);
                  const cancelDisabled =
                    isCancelling || !indexerOk || isCancellationClosed;
                  const cancelTitle = isCancellationClosed
                    ? isMarketCreator
                      ? "Settlement pending — your order stays locked until you settle this market"
                      : "Settlement pending — this order stays locked until the creator settles the market"
                    : !indexerOk
                      ? "Trading paused — indexer syncing"
                      : "Cancel order";

                  return (
                    <div
                      key={order.order_id}
                      className="grid grid-cols-[1fr_1fr_64px_72px_72px_40px] items-center rounded-lg px-3 py-2.5 text-xs transition-colors hover:bg-muted/10"
                    >
                      <span
                        className={cn(
                          "font-semibold",
                          order.side === "Buy"
                            ? "text-emerald-400"
                            : "text-red-400"
                        )}
                      >
                        {order.side}
                      </span>

                      <span
                        className={cn(
                          "font-mono",
                          order.token_type === "Yes"
                            ? "text-emerald-400"
                            : "text-red-400"
                        )}
                      >
                        {order.token_type}
                      </span>

                      <span className="text-right font-mono font-semibold">
                        {toDisplayPrice(order.price).toFixed(1)}¢
                      </span>

                      <span className="text-right font-mono text-muted-foreground">
                        {fmtQty(toDisplayQty(order.remaining_quantity))}
                        <span className="text-muted-foreground/40">
                          /{fmtQty(toDisplayQty(order.original_quantity))}
                        </span>
                      </span>

                      <span
                        className={cn(
                          "text-right text-[10px] font-semibold",
                          order.status === "Open"
                            ? "text-emerald-400"
                            : order.status === "PartiallyFilled"
                              ? "text-amber-400"
                              : order.status === "Filled"
                                ? "text-blue-400"
                                : "text-muted-foreground"
                        )}
                      >
                        {order.status === "PartiallyFilled"
                          ? "Partial"
                          : order.status}
                      </span>

                      {/* Cancel button — only for Open / PartiallyFilled */}
                      <div className="flex justify-end">
                        {canCancel && (
                          <button
                            onClick={() => handleCancel(order)}
                            disabled={cancelDisabled}
                            title={cancelTitle}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                          >
                            {isCancelling ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isCancellationClosed ? (
                              <Lock className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="px-3 pt-1 text-[10px] text-muted-foreground/40">
                {ordersList.length} order{ordersList.length !== 1 ? "s" : ""} ·
                refreshes every 10s
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
