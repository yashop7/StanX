"use server";

import { fetchAllDisplayMarkets, fetchDisplayMarketById } from "@/lib/blockchain/markets";
import type { DisplayMarket } from "@/lib/blockchain/markets";

export async function getMarketsAction(): Promise<{
  success: boolean;
  markets?: DisplayMarket[];
  error?: string;
}> {
  try {
    const markets = await fetchAllDisplayMarkets();
    return { success: true, markets };
  } catch (error) {
    console.error("getMarketsAction failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch markets",
    };
  }
}

export async function getMarketByIdAction(marketId: number): Promise<{
  success: boolean;
  market?: DisplayMarket;
  error?: string;
}> {
  try {
    const market = await fetchDisplayMarketById(marketId);
    if (!market) return { success: false, error: `Market #${marketId} not found on-chain` };
    return { success: true, market };
  } catch (error) {
    console.error("getMarketByIdAction failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch market",
    };
  }
}
