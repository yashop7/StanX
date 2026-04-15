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

// Cached fetchers (30s / 15s TTL — see revalidate below)
const getCachedAllMarkets = unstable_cache(
  () => fetchAllDisplayMarketsFromBackend(),
  ["all-markets"],
  { revalidate: 30 },
);

function getCachedMarketById(marketId: number) {
  return unstable_cache(
    () => fetchDisplayMarketByIdFromBackend(marketId),
    [`market-${marketId}`],
    { revalidate: 15 },
  )();
}

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
    if (!market) return { success: false, error: `Market #${marketId} not found` };
    return { success: true, market: reviveMarket(market) };
  } catch (error) {
    console.error(`getMarketByIdAction (backend) failed for #${marketId}, falling back to chain:`, error);
    // Fallback to direct chain read if backend is down
    try {
      const market = await fetchDisplayMarketById(marketId);
      if (!market) return { success: false, error: `Market #${marketId} not found on-chain` };
      return { success: true, market };
    } catch (chainError) {
      console.error(`getMarketByIdAction chain fallback failed for #${marketId}:`, chainError);
      return {
        success: false,
        error: chainError instanceof Error ? chainError.message : "Failed to fetch market",
      };
    }
  }
}
