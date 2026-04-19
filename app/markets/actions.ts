"use server";

import { unstable_cache } from "next/cache";
import {
  fetchAllDisplayMarketsFromBackend,
  fetchDisplayMarketByIdFromBackend,
  fetchAllDisplayMarkets,
  fetchDisplayMarketById,
} from "@/lib/blockchain/markets";
import type { DisplayMarket } from "@/lib/blockchain/markets";

// unstable_cache serializes its return value through JSON, which turns Date
// objects into ISO strings. reviveMarket reconstructs them after the cache hit.
function reviveMarket(m: DisplayMarket): DisplayMarket {
  return { ...m, endDate: new Date(m.endDate) };
}

// Module-level cached fetchers.
// unstable_cache MUST be defined at module level — recreating it inside a function
// produces a new function reference each call, breaking Next.js's cache lookup.
// Passing marketId as an argument lets Next.js derive a unique cache key per ID.
const getCachedAllMarkets = unstable_cache(
  () => fetchAllDisplayMarketsFromBackend(),
  ["all-markets"],
  { revalidate: 30 },
);

const getCachedMarketById = unstable_cache(
  (marketId: number) => fetchDisplayMarketByIdFromBackend(marketId),
  ["market-by-id"],
  { revalidate: 15 },
);

export async function getMarketsAction(): Promise<{
  success: boolean;
  markets?: DisplayMarket[];
  error?: string;
}> {
  try {
    const markets = await getCachedAllMarkets();
    return { success: true, markets: markets.map(reviveMarket) };
  } catch (error) {
    console.error("getMarketsAction (backend) failed, falling back to chain:", error);
    // Fallback to direct chain read if backend is down
    try {
      const markets = await fetchAllDisplayMarkets();
      return { success: true, markets };
    } catch (chainError) {
      console.error("getMarketsAction chain fallback also failed:", chainError);
      return {
        success: false,
        error: chainError instanceof Error ? chainError.message : "Failed to fetch markets",
      };
    }
  }
}

export async function getMarketByIdAction(marketId: number): Promise<{
  success: boolean;
  market?: DisplayMarket;
  error?: string;
}> {
  try {
    const market = await getCachedMarketById(marketId);
    if (!market) return { success: false, error: `Market #${marketId} does not exist` };
    return { success: true, market: reviveMarket(market) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Only fall back to chain if the backend itself is unreachable (not a 404)
    const isNotFound = msg.includes('404');
    if (isNotFound) return { success: false, error: `Market #${marketId} does not exist` };

    console.error(`getMarketByIdAction backend failed for #${marketId}, falling back to chain:`, error);
    try {
      const market = await fetchDisplayMarketById(marketId);
      if (!market) return { success: false, error: `Market #${marketId} does not exist` };
      return { success: true, market };
    } catch (chainError) {
      console.error(`getMarketByIdAction chain fallback failed for #${marketId}:`, chainError);
      return {
        success: false,
        error: `Backend unavailable — ${chainError instanceof Error ? chainError.message : "Failed to fetch market"}`,
      };
    }
  }
}
