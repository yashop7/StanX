/**
 * Blockchain interaction layer — OrderBook fetch.
 *
 * Only this file touches @solana/kit directly for orderbook reads.
 * React components import the plain async function `fetchOnChainOrderBook`.
 *
 * Price encoding assumption (adjust PRICE_SCALE if numbers look wrong):
 *   The on-chain `price` field is stored in micro-USDC (6 decimal places).
 *   500_000 micro-USDC  →  0.5 USDC  →  50¢  →  displayDecimal = 0.50
 *
 * Quantity encoding assumption:
 *   The on-chain `quantity` and `filledquantity` fields are also in micro-USDC
 *   denominated shares.  1_000_000 units = 1 share.
 */

import {
  getProgramDerivedAddress,
  getBytesEncoder,
  getU32Encoder,
  type Address,
} from "@solana/kit";
import { fetchMaybeOrderBook } from "@/generated/accounts/orderBook";
import type { Order } from "@/generated/types";
import { PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS } from "@/generated/programs";
import { rpc } from "./client";

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * USDC has 6 decimal places.  Prices are stored as micro-USDC (0 – 1_000_000).
 * Change this constant if the on-chain representation uses a different scale.
 */
const PRICE_SCALE = 1_000_000;

/**
 * Quantities are whole integer shares (e.g. "05" = 5 shares), no scaling needed.
 */
const QTY_SCALE = 1;

// ── PDA derivation ─────────────────────────────────────────────────────────────

/**
 * Derives the orderbook PDA for a given market.
 * Seeds: [ b"orderbook", market_id (u32 little-endian) ]
 * Matches the derivation in generated/instructions/initializeMarket.ts line 363.
 */
async function deriveOrderBookPDA(marketId: number): Promise<Address> {
  const ORDERBOOK_SEED = new Uint8Array([
    111, 114, 100, 101, 114, 98, 111, 111, 107, // "orderbook"
  ]);

  const [pda] = await getProgramDerivedAddress({
    programAddress: PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS,
    seeds: [
      getBytesEncoder().encode(ORDERBOOK_SEED),
      getU32Encoder().encode(marketId),
    ],
  });

  return pda;
}

// ── Display types ──────────────────────────────────────────────────────────────

/** Single price level in the order book display. */
export interface ChainLevel {
  price: number;    // 0–1 decimal (0.50 = 50¢)
  size: number;     // remaining unfilled shares
  total: number;    // cumulative total (ascending from best)
  isUser: boolean;  // true when any order at this level belongs to currentUserKey
}

/** Processed order book ready for rendering. */
export interface ChainOrderBook {
  /** Sell-side (YES sellers).  Sorted lowest-ask first. */
  asks: ChainLevel[];
  /** Buy-side (YES buyers).  Sorted highest-bid first. */
  bids: ChainLevel[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDecimalPrice(price: bigint): number {
  return Number(price) / PRICE_SCALE;
}

function remainingShares(quantity: bigint, filled: bigint): number {
  const rem = quantity > filled ? quantity - filled : BigInt(0);
  return Number(rem) / QTY_SCALE;
}

/**
 * Aggregates individual orders at the same price level into a single row.
 * An isUser flag is set if *any* order at that level belongs to currentUserKey.
 */
function aggregateByPrice(
  orders: Array<Order>,
  currentUserKey?: string,
): ChainLevel[] {
  const map = new Map<number, { size: number; isUser: boolean }>();

  for (const order of orders) {
    const shares = remainingShares(order.quantity, order.filledquantity);
    if (shares <= 0) continue; // fully filled — skip

    // Round to 4 decimal places so floating-point drift doesn't create phantom levels
    const priceKey = Math.round(toDecimalPrice(order.price) * 10_000) / 10_000;
    const isUser =
      !!currentUserKey && order.userKey === (currentUserKey as string);

    const existing = map.get(priceKey);
    if (existing) {
      existing.size += shares;
      if (isUser) existing.isUser = true;
    } else {
      map.set(priceKey, { size: shares, isUser });
    }
  }

  return [...map.entries()].map(([price, d]) => ({
    price,
    size: d.size,
    total: 0,
    isUser: d.isUser,
  }));
}

function addCumulativeTotals(levels: ChainLevel[]): void {
  let cum = 0;
  for (const level of levels) {
    cum += level.size;
    level.total = cum;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetches and parses the on-chain order book for a given market.
 *
 * YES side semantics (matches the on-chain OrderBook account fields):
 *   - yesBuyOrders  → bids (buyers want to acquire YES tokens)
 *   - yesSellOrders → asks (sellers want to liquidate YES tokens)
 *
 * NO side orders are NOT shown in this view (the YES price implies the NO price).
 *
 * @param marketId       On-chain u32 market ID.
 * @param currentUserKey Solana address of the current user (to flag their rows).
 * @returns Parsed ChainOrderBook, or null if the account does not exist on-chain.
 */
export async function fetchOnChainOrderBook(
  marketId: number,
  currentUserKey?: string,
): Promise<ChainOrderBook | null> {
  const pdaAddress = await deriveOrderBookPDA(marketId);

  // Cast required because fetchMaybeOrderBook wants Address<string> not string
  const maybeAccount = await fetchMaybeOrderBook(rpc, pdaAddress);

  if (!maybeAccount.exists) return null;

  const book = maybeAccount.data;

  // Asks: people selling YES tokens (red / sell side)
  const asks = aggregateByPrice(book.yesSellOrders, currentUserKey).sort(
    (a, b) => a.price - b.price, // lowest ask first → best ask nearest the mid
  );
  addCumulativeTotals(asks);

  // Bids: people buying YES tokens (green / buy side)
  const bids = aggregateByPrice(book.yesBuyOrders, currentUserKey).sort(
    (a, b) => b.price - a.price, // highest bid first → best bid nearest the mid
  );
  addCumulativeTotals(bids);

  return { asks, bids };
}
