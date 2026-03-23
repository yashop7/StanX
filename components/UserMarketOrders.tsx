'use client';

/**
 * UserMarketOrders
 * Fetches GET /markets/:marketId/orders/:userPubkey directly and renders the result.
 * Self-contained — no parent state needed.
 */

import { useState, useEffect } from 'react';
import { fetchUserMarketOrders, toDisplayPrice, toDisplayQty } from '@/lib/api/backend';
import type { BackendOrder } from '@/lib/api/backend';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  marketId: number;
  userPubkey: string | undefined;
}

function fmtQty(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? String(n) : n.toFixed(4);
}

export function UserMarketOrders({ marketId, userPubkey }: Props) {
  const [orders, setOrders] = useState<BackendOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!userPubkey) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserMarketOrders(marketId, userPubkey);
      setOrders(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch on mount and whenever marketId / userPubkey changes
  useEffect(() => {
    load();
    // Poll every 10s to reflect fills/cancellations
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, userPubkey]);

  if (!userPubkey) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Connect your wallet to see your orders.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Debug header — shows exactly what URL is being hit */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono text-muted-foreground/60 break-all">
          GET /markets/{marketId}/orders/{userPubkey}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          className="h-6 px-2 text-[10px] text-muted-foreground gap-1"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Loading (first load) */}
      {loading && orders === null && (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading orders…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && orders !== null && orders.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No orders found in this market.
        </p>
      )}

      {/* Orders table */}
      {orders && orders.length > 0 && (
        <>
          <div className="grid grid-cols-5 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20">
            <span>Side</span>
            <span>Token</span>
            <span className="text-right">Price</span>
            <span className="text-right">Remaining</span>
            <span className="text-right">Status</span>
          </div>

          <div className="space-y-0.5">
            {orders.map((order) => (
              <div
                key={order.order_id}
                className="grid grid-cols-5 items-center px-3 py-2.5 text-xs rounded-lg hover:bg-muted/10 transition-colors"
              >
                <span className={cn(
                  'font-semibold',
                  order.side === 'Buy' ? 'text-emerald-400' : 'text-red-400',
                )}>
                  {order.side}
                </span>

                <span className={cn(
                  'font-mono',
                  order.token_type === 'Yes' ? 'text-emerald-400' : 'text-red-400',
                )}>
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

                <span className={cn(
                  'text-right text-[10px] font-semibold',
                  order.status === 'Open'            ? 'text-emerald-400' :
                  order.status === 'PartiallyFilled' ? 'text-amber-400'   :
                  order.status === 'Filled'          ? 'text-blue-400'    :
                                                       'text-muted-foreground',
                )}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground/40 px-3 pt-1">
            {orders.length} order{orders.length !== 1 ? 's' : ''} · refreshes every 10s
          </p>
        </>
      )}
    </div>
  );
}
