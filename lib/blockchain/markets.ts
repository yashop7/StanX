/**
 * Blockchain interaction layer — Market display data.
 *
 * Fetches markets from Solana, enriches them with orderbook-derived prices,
 * and tries to pull human-readable metadata from the on-chain metaDataUrl.
 *
 * This file has NO "use server" — it can run on both server and client.
 * Wrap calls in server actions (app/markets/actions.ts) to call from the UI.
 */

import {
  getProgramDerivedAddress,
  getBytesEncoder,
  getU32Encoder,
  type Address,
} from "@solana/kit";
import {
  fetchMaybeMarket,
  fetchAllMaybeMarket,
  MARKET_DISCRIMINATOR,
  type Market as ChainMarket,
} from "@/generated/accounts/market";
import { PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS } from "@/generated/programs";
import { rpc } from "./client";
import { fetchOnChainOrderBook } from "./orderbook";

// ── Constants ──────────────────────────────────────────────────────────────────

const USDC_SCALE = 1_000_000; // USDC has 6 decimal places

// Bytes for the "market" seed string  [109, 97, 114, 107, 101, 116]
const MARKET_SEED = new Uint8Array([109, 97, 114, 107, 101, 116]);

// ── Public display type ────────────────────────────────────────────────────────

/**
 * A market enriched with prices and metadata, ready for UI rendering.
 * All BigInt values from the chain are converted to plain numbers here.
 */
export interface DisplayMarket {
  address: string;
  marketId: number;                            // on-chain u32, used in URLs
  authority: string;                           // market creator's pubkey
  collateralMint: string;                      // SPL token mint used as collateral
  outcomeYesMint: string;                      // SPL mint for YES outcome tokens
  outcomeNoMint: string;                       // SPL mint for NO outcome tokens
  question: string;                            // from metadata or "Market #N"
  yesPrice: number;                            // 0–1 decimal
  noPrice: number;                             // 0–1 decimal
  volume: number;                              // USDC (totalCollateralLocked / 1e6)
  endDate: Date;                               // from settlementDeadline
  isSettled: boolean;
  winningOutcome: "YES" | "NO" | "NEITHER" | null; // null if not settled yet
  status: "active" | "resolved" | "ending-soon";
  metaDataUrl: string;
  image: string;
  category: string;
  description: string;
  resolutionCriteria: string;
  participants: number;
  priceHistory: { time: number; value: number }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function deriveMarketPDA(marketId: number): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS,
    seeds: [
      getBytesEncoder().encode(MARKET_SEED),
      getU32Encoder().encode(marketId),
    ],
  });
  return pda;
}

function deriveYesPrice(
  book: { asks: Array<{ price: number }>; bids: Array<{ price: number }> } | null,
): number {
  if (!book) return 0.5;
  const bestAsk = book.asks.at(0)?.price;
  const bestBid = book.bids.at(0)?.price;
  if (bestAsk !== undefined && bestBid !== undefined) return (bestAsk + bestBid) / 2;
  return bestAsk ?? bestBid ?? 0.5;
}

function deriveStatus(data: ChainMarket): "active" | "resolved" | "ending-soon" {
  if (data.isSettled) return "resolved";
  const msLeft = Number(data.settlementDeadline) * 1000 - Date.now();
  if (msLeft <= 3 * 24 * 60 * 60 * 1000) return "ending-soon";
  return "active";
}

/** Generates a plausible synthetic price history for chart display. */
function syntheticPriceHistory(base: number, points = 60): { time: number; value: number }[] {
  const history: { time: number; value: number }[] = [];
  let price = base;
  const now = Date.now();
  for (let i = points; i >= 0; i--) {
    price = Math.max(0.01, Math.min(0.99, price + (Math.random() - 0.5) * 0.015));
    history.push({ time: now - i * 3_600_000, value: price });
  }
  return history;
}

interface OffChainMeta {
  question?: string;
  image?: string;
  description?: string;
  category?: string;
  resolutionCriteria?: string;
}

/**
 * Tries to fetch JSON metadata from the metaDataUrl.
 * If the URL is not a URL (e.g. a plain-text question), treats it as the question.
 * Never throws — returns empty object on any failure.
 */
async function tryFetchMetadata(url: string): Promise<OffChainMeta> {
  if (!url) return {};
  // If it's not a URL, treat the whole string as the question
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { question: url };
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    if (!res.ok) return {};
    const json = (await res.json()) as Record<string, unknown>;
    return {
      question: (json.title ?? json.question ?? json.name) as string | undefined,
      image: json.image as string | undefined,
      description: json.description as string | undefined,
      category: json.category as string | undefined,
      resolutionCriteria: (json.resolutionCriteria ?? json.resolution_criteria) as string | undefined,
    };
  } catch {
    return {};
  }
}

function enrichChainMarket(
  address: Address,
  data: ChainMarket,
  book: { asks: Array<{ price: number }>; bids: Array<{ price: number }> } | null,
  meta: OffChainMeta,
): DisplayMarket {
  const yesPrice = deriveYesPrice(book);
  const wo = data.winningOutcome;
  const winningOutcome: DisplayMarket["winningOutcome"] =
    wo.__option === "Some"
      ? wo.value === 0 ? "YES"
        : wo.value === 1 ? "NO"
        : "NEITHER"
      : null;
  return {
    address: address as string,
    marketId: data.marketId,
    authority: data.authority as string,
    collateralMint: data.collateralMint as string,
    outcomeYesMint: data.outcomeYesMint as string,
    outcomeNoMint: data.outcomeNoMint as string,
    question: meta.question ?? `Market #${data.marketId}`,
    yesPrice,
    noPrice: 1 - yesPrice,
    volume: Number(data.totalCollateralLocked) / USDC_SCALE,
    endDate: new Date(Number(data.settlementDeadline) * 1000),
    isSettled: data.isSettled,
    winningOutcome,
    status: deriveStatus(data),
    metaDataUrl: data.metaDataUrl,
    image: meta.image ?? `https://picsum.photos/seed/${data.marketId}/800/600`,
    category: meta.category ?? "General",
    description: meta.description ?? `On-chain prediction market #${data.marketId}.`,
    resolutionCriteria: meta.resolutionCriteria ?? "Resolves based on on-chain settlement.",
    participants: 0,
    priceHistory: syntheticPriceHistory(yesPrice),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetches all markets from the program, enriches each with orderbook prices
 * and optional off-chain metadata. Returns them sorted by marketId ascending.
 */
export async function fetchAllDisplayMarkets(): Promise<DisplayMarket[]> {
  // Step 1: discover all market account addresses via getProgramAccounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (rpc as any)
    .getProgramAccounts(PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset: BigInt(0),
            bytes: Buffer.from(MARKET_DISCRIMINATOR).toString("base64"),
            encoding: "base64",
          },
        },
      ],
    })
    .send();

  const accounts: Array<{ pubkey: Address }> = Array.isArray(response)
    ? response
    : (response?.value ?? []);
  if (accounts.length === 0) return [];

  const addresses = accounts.map((a: { pubkey: Address }) => a.pubkey);

  // Step 2: batch-fetch all market accounts
  const maybeAccounts = await fetchAllMaybeMarket(rpc, addresses);

  // Step 3: enrich each market in parallel
  const enriched = await Promise.all(
    maybeAccounts.map(async (maybeAccount, i) => {
      if (!maybeAccount.exists) return null;
      const { data } = maybeAccount;
      const [book, meta] = await Promise.all([
        fetchOnChainOrderBook(data.marketId).catch(() => null),
        tryFetchMetadata(data.metaDataUrl),
      ]);
      return enrichChainMarket(addresses[i], data, book, meta);
    }),
  );

  return (enriched.filter(Boolean) as DisplayMarket[]).sort((a, b) => a.marketId - b.marketId);
}

/**
 * Fetches a single market by its on-chain marketId (u32).
 * Derives the PDA directly — more efficient than fetching all markets.
 */
export async function fetchDisplayMarketById(marketId: number): Promise<DisplayMarket | null> {
  const pdaAddress = await deriveMarketPDA(marketId);
  const maybeAccount = await fetchMaybeMarket(rpc, pdaAddress);
  if (!maybeAccount.exists) return null;

  const { data } = maybeAccount;
  const [book, meta] = await Promise.all([
    fetchOnChainOrderBook(data.marketId).catch(() => null),
    tryFetchMetadata(data.metaDataUrl),
  ]);

  return enrichChainMarket(pdaAddress, data, book, meta);
}
