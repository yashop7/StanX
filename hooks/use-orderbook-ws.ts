'use client';

/**
 * useOrderbookWs — connects to the StanX backend WebSocket for a market
 * and maintains a live local orderbook by applying snapshot + diff messages.
 *
 * Protocol (from BACKEND-INTEGRATION-FILE.md):
 *   1. On connect → server sends OrderbookSnapshot (full state)
 *   2. On change  → server sends OrderbookDiff (incremental update)
 *   3. On lag     → server resends OrderbookSnapshot (replace everything)
 *
 * Distinguishing snapshot vs diff: presence of `yes_bids` key.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BackendOrder, OrderbookSnapshot, OrderbookDiff } from '@/lib/api/backend';
import { getOrderbookWsUrl } from '@/lib/api/backend';

export type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type LiveOrderbook = OrderbookSnapshot;

// ─── Diff helpers ──────────────────────────────────────────────────────────────

/**
 * Apply a diff to one side of the orderbook.
 * - Remove all order_ids in `removed`
 * - Remove any existing order_ids that are also in `added` (partial-fill replace)
 * - Concat `added` entries
 * - Re-sort
 */
function applySide(
  current: BackendOrder[],
  added: BackendOrder[],
  removed: number[],
  sortDesc: boolean,
): BackendOrder[] {
  const addedIds = new Set(added.map((o) => o.order_id));
  const removedIds = new Set(removed);
  const filtered = current.filter(
    (o) => !removedIds.has(o.order_id) && !addedIds.has(o.order_id),
  );
  const next = filtered.concat(added);
  next.sort((a, b) => (sortDesc ? b.price - a.price : a.price - b.price));
  return next;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useOrderbookWs(marketId: number | null) {
  const [orderbook, setOrderbook] = useState<LiveOrderbook | null>(null);
  const [status, setStatus] = useState<WsStatus>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  // Keep marketId accessible inside callbacks without re-registering them
  const marketIdRef = useRef(marketId);
  marketIdRef.current = marketId;

  const clearReconnect = useCallback(() => {
    if (reconnectRef.current !== null) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const id = marketIdRef.current;
    if (id == null) return;

    // Close any existing socket before opening a new one
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect loop on intentional close
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const url = getOrderbookWsUrl(id);
    setStatus('connecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      // WebSocket constructor throws for invalid URLs
      setStatus('disconnected');
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setStatus('connected');
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>;

        if ('yes_bids' in msg) {
          // Full snapshot — replace entire orderbook
          setOrderbook(msg as unknown as LiveOrderbook);
        } else {
          // Incremental diff — apply to current state
          const diff = msg as unknown as OrderbookDiff;
          setOrderbook((prev) => {
            if (!prev) return prev; // no snapshot yet; ignore diffs
            return {
              slot: diff.slot,
              market_id: diff.market_id,
              yes_bids: applySide(prev.yes_bids, diff.yes_bids_added, diff.yes_bids_removed, true),
              yes_asks: applySide(prev.yes_asks, diff.yes_asks_added, diff.yes_asks_removed, false),
              no_bids: applySide(prev.no_bids, diff.no_bids_added, diff.no_bids_removed, true),
              no_asks: applySide(prev.no_asks, diff.no_asks_added, diff.no_asks_removed, false),
            };
          });
        }
      } catch (err) {
        console.error('[OrderbookWS] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      attemptRef.current += 1;
      if (attemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        setStatus('disconnected');
        return;
      }
      const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_RECONNECT_DELAY_MS);
      setStatus('reconnecting');
      reconnectRef.current = setTimeout(() => connect(), delay);
    };

    ws.onerror = () => {
      // onclose fires after onerror; reconnect is handled there
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (marketId == null) {
      setOrderbook(null);
      setStatus('disconnected');
      return;
    }

    attemptRef.current = 0;
    connect();

    return () => {
      clearReconnect();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus('disconnected');
      setOrderbook(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  return { orderbook, status };
}
