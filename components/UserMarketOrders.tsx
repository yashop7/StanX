'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchUserMarketOrders, toDisplayPrice, toDisplayQty } from '@/lib/api/backend';
import type { BackendOrder } from '@/lib/api/backend';
import { Loader2, RefreshCw, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWalletSession, useSendTransaction } from '@solana/react-hooks';
import { createWalletTransactionSigner } from '@solana/client';
import { buildCancelOrderInstruction } from '@/lib/blockchain/market';
import { toast } from 'sonner';
import { useIndexerHealth } from '@/hooks/use-indexer-health';

interface Props {
  marketId: number;
  userPubkey: string | undefined;
}

function fmtQty(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? String(n) : n.toFixed(4);
}

const CANCELLABLE = new Set(['Open', 'PartiallyFilled']);

export function UserMarketOrders({ marketId, userPubkey }: Props) {
  const [orders, setOrders] = useState<BackendOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<bigint | null>(null);
  // Track previous statuses to detect fills between polls
  const prevStatusRef = useRef<Map<number, BackendOrder['status']>>(new Map());

  const session = useWalletSession();
  const { send } = useSendTransaction();
  const { indexerOk } = useIndexerHealth();

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
            if (order.status === 'Filled') {
              toast.success(
                `Order #${order.order_id} filled`,
                { description: `${order.side} ${order.token_type} @ ${toDisplayPrice(order.price).toFixed(1)}¢` }
              );
            } else if (order.status === 'PartiallyFilled' && prevStatus === 'Open') {
              toast(`Order #${order.order_id} partially filled`, {
                description: `${order.side} ${order.token_type} — ${toDisplayQty(order.remaining_quantity).toFixed(2)} remaining`,
              });
            }
          }
        }
      }
      // Update the snapshot
      prevStatusRef.current = new Map(data.map(o => [o.order_id, o.status]));

      setOrders(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch orders');
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
    if (!session) { toast.error('Connect your wallet to cancel orders.'); return; }

    const orderId = BigInt(order.order_id);
    setCancelling(orderId);
    try {
      const { signer } = createWalletTransactionSigner(session);
      const ix = await buildCancelOrderInstruction({
        userSigner: signer,
        marketId,
        orderId,
        orderSide:  order.side === 'Buy' ? 'BUY' : 'SELL',
        tokenType:  order.token_type === 'Yes' ? 'YES' : 'NO',
      });
      await send({ instructions: [ix], authority: signer });
      toast.success(`Order #${order.order_id} cancelled`);
      // Refresh after short delay so backend has time to index
      setTimeout(load, 2000);
    } catch (e) {
      toast.error('Cancel failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCancelling(null);
    }
  }

  if (!userPubkey) {
    return <p className="text-sm text-muted-foreground text-center py-8">Connect your wallet to see your orders.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">My Orders</p>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-6 px-2 text-[10px] text-muted-foreground gap-1">
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {loading && orders === null && (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading orders…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {!loading && orders !== null && orders.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center py-8">No orders found in this market.</p>
      )}

      {orders && orders.length > 0 && (
        <>
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_64px_72px_72px_40px] px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20">
            <span>Side</span>
            <span>Token</span>
            <span className="text-right">Price</span>
            <span className="text-right">Remaining</span>
            <span className="text-right">Status</span>
            <span />
          </div>

          <div className="space-y-0.5">
            {orders.map((order) => {
              const oid = BigInt(order.order_id);
              const isCancelling = cancelling === oid;
              const canCancel = CANCELLABLE.has(order.status);

              return (
                <div
                  key={order.order_id}
                  className="grid grid-cols-[1fr_1fr_64px_72px_72px_40px] items-center px-3 py-2.5 text-xs rounded-lg hover:bg-muted/10 transition-colors"
                >
                  <span className={cn('font-semibold', order.side === 'Buy' ? 'text-emerald-400' : 'text-red-400')}>
                    {order.side}
                  </span>

                  <span className={cn('font-mono', order.token_type === 'Yes' ? 'text-emerald-400' : 'text-red-400')}>
                    {order.token_type}
                  </span>

                  <span className="text-right font-mono font-semibold">
                    {toDisplayPrice(order.price).toFixed(1)}¢
                  </span>

                  <span className="text-right font-mono text-muted-foreground">
                    {fmtQty(toDisplayQty(order.remaining_quantity))}
                    <span className="text-muted-foreground/40">/{fmtQty(toDisplayQty(order.original_quantity))}</span>
                  </span>

                  <span className={cn(
                    'text-right text-[10px] font-semibold',
                    order.status === 'Open'            ? 'text-emerald-400' :
                    order.status === 'PartiallyFilled' ? 'text-amber-400'   :
                    order.status === 'Filled'          ? 'text-blue-400'    :
                                                         'text-muted-foreground',
                  )}>
                    {order.status}
                  </span>

                  {/* Cancel button — only for Open / PartiallyFilled */}
                  <div className="flex justify-end">
                    {canCancel && (
                      <button
                        onClick={() => handleCancel(order)}
                        disabled={isCancelling || !indexerOk}
                        title={!indexerOk ? "Trading paused — indexer syncing" : "Cancel order"}
                        className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                      >
                        {isCancelling
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <X className="h-3 w-3" />
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground/40 px-3 pt-1">
            {orders.length} order{orders.length !== 1 ? 's' : ''} · refreshes every 10s
          </p>
        </>
      )}
    </div>
  );
}
