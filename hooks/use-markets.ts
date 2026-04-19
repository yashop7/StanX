"use client";

import useSWR from "swr";
import { getMarketByIdAction, getMarketsAction } from "@/app/markets/actions";
import type { DisplayMarket } from "@/lib/blockchain/markets";

/**
 * SWR-based data hooks. Benefits over bare useEffect + server action:
 *  - Auto-dedupe: identical keys fetched in the same dedup window share one request.
 *    This fixes the "two POST /market/:id" issue in dev caused by React Strict Mode
 *    double-invoking effects.
 *  - Background revalidation: on tab focus, on reconnect, and every refreshInterval ms.
 *  - Stale-while-revalidate: UI shows cached data instantly, refetches in background.
 *  - Shared cache: the same key across components returns the same data — no duplicate fetches.
 */

async function fetchMarketById(marketId: number): Promise<DisplayMarket | null> {
  const res = await getMarketByIdAction(marketId);
  if (!res.success || !res.market) throw new Error(res.error ?? "Market not found");
  return res.market;
}

async function fetchAllMarkets(): Promise<DisplayMarket[]> {
  const res = await getMarketsAction();
  if (!res.success || !res.markets) throw new Error(res.error ?? "Failed to load markets");
  return res.markets;
}

/**
 * Fetches a single market by ID. Cached for 15s, revalidates on focus.
 * Pass NaN or negative to skip the fetch.
 */
export function useMarket(marketId: number) {
  const shouldFetch = Number.isFinite(marketId) && marketId >= 0;
  const { data, error, isLoading, mutate } = useSWR<DisplayMarket | null>(
    shouldFetch ? ["market", marketId] : null,
    () => fetchMarketById(marketId),
    {
      dedupingInterval: 5_000,   // prevent rapid duplicate calls; server action caches for 15s anyway
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: false,   // don't show stale market data when ID changes or on error
    },
  );
  return {
    market: data ?? null,
    error: error as Error | undefined,
    isLoading,
    /** Force a refetch (e.g. after placing an order). */
    refresh: mutate,
  };
}

/**
 * Fetches every market. Cached for 30s, lower priority than useMarket.
 */
export function useAllMarkets() {
  const { data, error, isLoading, mutate } = useSWR<DisplayMarket[]>(
    ["markets", "all"],
    fetchAllMarkets,
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );
  return {
    markets: data ?? [],
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  };
}
