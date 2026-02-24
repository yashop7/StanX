"use server";

/**
 * Server actions for market operations.
 * These run on the server side and have access to env variables.
 */

import { address } from "@solana/kit";
import { initializeMarket, getAllMarkets } from "@/lib/blockchain/market";
import { getAuthorityFromEnv } from "@/lib/blockchain/keypair";
import type { Market } from "@/generated/accounts/market";
import type { Address } from "@solana/kit";

export interface InitializeMarketFormData {
  marketId: number;
  settlementDeadline: string; // ISO date string
  metadataUrl: string;
}

export interface MarketWithAddress {
  address: string;
  data: Market;
}

/**
 * Server action to initialize a new market.
 * Uses the KEYPAIR from .env as authority.
 * Hardcoded to USDC devnet as collateral.
 */
export async function initializeMarketAction(
  formData: InitializeMarketFormData
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    // Devnet USDC mint
    const USDC_DEVNET = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

    // Get authority from env
    const authority = await getAuthorityFromEnv();

    // Convert date to unix timestamp (seconds)
    const settlementDeadline = BigInt(
      Math.floor(new Date(formData.settlementDeadline).getTime() / 1000)
    );

    // Call the blockchain function
    const result = await initializeMarket({
      authority,
      collateralMint: USDC_DEVNET,
      marketId: formData.marketId,
      settlementDeadline,
      metadataUrl: formData.metadataUrl || "",
    });

    return {
      success: true,
      signature: result.signature,
    };
  } catch (error) {
    console.error("Failed to initialize market:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Server action to fetch all existing markets.
 */
export async function fetchAllMarketsAction(): Promise<{
  success: boolean;
  markets?: MarketWithAddress[];
  error?: string;
}> {
  try {
    const markets = await getAllMarkets();

    // Convert Address type to string for serialization
    const serializedMarkets = markets.map((m) => ({
      address: m.address as string,
      data: m.data,
    }));

    return {
      success: true,
      markets: serializedMarkets,
    };
  } catch (error) {
    console.error("Failed to fetch markets:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
