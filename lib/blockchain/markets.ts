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
import {
  fetchBackendMarkets,
  fetchBackendMarket,
  fetchBackendOrderbook,
} from "@/lib/api/backend";

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
  resolutionSource?: string;
  participants: number;
  // YouTube-specific fields (present only for video markets)
  videoId?: string;
  videoUrl?: string;
  channelName?: string;
  metric?: string;                             // e.g. "viewCount", "likeCount", "commentCount"
  target?: number;
  baselineValue?: number;
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


interface OffChainMeta {
  question?: string;
  image?: string;
  description?: string;
  category?: string;
  resolutionCriteria?: string;
  resolutionSource?: string;
  videoId?: string;
  videoUrl?: string;
  channelName?: string;
  metric?: string;
  target?: number;
  baselineValue?: number;
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
    // Arweave/Irys metadata is immutable — cache it for 5 minutes to avoid
    // hitting the gateway on every request. AbortSignal.timeout is not compatible
    // with Next.js fetch cache, so we rely on the revalidate TTL instead.
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    const json = (await res.json()) as Record<string, unknown>;

    // Parse Metaplex-style attributes array for YouTube-specific fields
    const attrs = Array.isArray(json.attributes)
      ? (json.attributes as Array<{ trait_type: string; value: string }>)
      : [];
    const attr = (key: string) => attrs.find(a => a.trait_type === key)?.value;

    const targetRaw = attr("Target");
    const baselineRaw = attr("Baseline Value");

    return {
      question: (json.title ?? json.question ?? json.name) as string | undefined,
      image: json.image as string | undefined,
      description: json.description as string | undefined,
      category: attr("Category") ?? json.category as string | undefined,
      resolutionCriteria: attr("Resolution Criteria") ?? (json.resolutionCriteria ?? json.resolution_criteria) as string | undefined,
      resolutionSource: attr("Resolution Source"),
      videoId: attr("Video ID"),
      videoUrl: attr("Video URL"),
      channelName: attr("Channel"),
      metric: attr("Metric"),
      target: targetRaw ? parseInt(targetRaw, 10) : undefined,
      baselineValue: baselineRaw ? parseInt(baselineRaw, 10) : undefined,
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
    resolutionSource: meta.resolutionSource,
    participants: 0,
    videoId: meta.videoId,
    videoUrl: meta.videoUrl,
    channelName: meta.channelName,
    metric: meta.metric,
    target: meta.target,
    baselineValue: meta.baselineValue,
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

  // Step 3: enrich markets in batches to avoid RPC 429s.
  // Metadata fetches are HTTP (not Solana RPC) so they run freely in parallel;
  // only the orderbook RPC calls are throttled — 3 at a time with 300ms between batches.
  const BATCH_SIZE = 3;
  const BATCH_DELAY_MS = 300;

  const tasks = maybeAccounts.map((maybeAccount, i) => async () => {
    if (!maybeAccount.exists) return null;
    const { data } = maybeAccount;
    const [book, meta] = await Promise.all([
      fetchOnChainOrderBook(data.marketId).catch(() => null),
      tryFetchMetadata(data.metaDataUrl),
    ]);
    return enrichChainMarket(addresses[i], data, book, meta);
  });

  const enriched: (DisplayMarket | null)[] = [];
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = await Promise.all(tasks.slice(i, i + BATCH_SIZE).map(fn => fn()));
    enriched.push(...batch);
    if (i + BATCH_SIZE < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return (enriched.filter(Boolean) as DisplayMarket[]).sort((a, b) => a.marketId - b.marketId);
}

// ── Backend-powered variants (no Solana RPC for reads) ─────────────────────────

/** 1_000_000 micro-USDC = price 1.0 (100%) on-chain */
const CHAIN_PRICE_SCALE = 1_000_000;

/**
 * Derive yes/no price from the backend REST orderbook snapshot.
 * Uses best bid + best ask of YES orders (mid-price), same logic as the on-chain path.
 */
function derivePriceFromBackendBook(book: {
  yes_buy_orders: Array<{ price: number }>;
  yes_sell_orders: Array<{ price: number }>;
}): { yesPrice: number; noPrice: number } {
  const bestBid = book.yes_buy_orders[0]?.price;   // sorted DESC already
  const bestAsk = book.yes_sell_orders[0]?.price;  // sorted ASC already

  let yesPrice: number;
  if (bestBid !== undefined && bestAsk !== undefined) {
    yesPrice = (bestBid + bestAsk) / 2 / CHAIN_PRICE_SCALE;
  } else if (bestAsk !== undefined) {
    yesPrice = bestAsk / CHAIN_PRICE_SCALE;
  } else if (bestBid !== undefined) {
    yesPrice = bestBid / CHAIN_PRICE_SCALE;
  } else {
    yesPrice = 0.5;
  }

  return { yesPrice, noPrice: 1 - yesPrice };
}

/**
 * Fetches all markets from the **backend** (no Solana RPC).
 * PDA is derived locally (pure math). Metadata still fetched from metaDataUrl.
 * Sorted by marketId ascending.
 */
export async function fetchAllDisplayMarketsFromBackend(): Promise<DisplayMarket[]> {
  const backendMarkets = await fetchBackendMarkets();
  if (backendMarkets.length === 0) return [];

  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 100;

  const tasks = backendMarkets.map((bm) => async (): Promise<DisplayMarket | null> => {
    const [pdaAddress, orderbookResult, meta] = await Promise.all([
      deriveMarketPDA(bm.market_id),
      fetchBackendOrderbook(bm.market_id).catch(() => null),
      tryFetchMetadata(bm.meta_data_url),
    ]);

    const { yesPrice, noPrice } = orderbookResult
      ? derivePriceFromBackendBook(orderbookResult)
      : { yesPrice: 0.5, noPrice: 0.5 };

    const isSettled = bm.status === "Settled" || bm.status === "Closed";
    const winningOutcome: DisplayMarket["winningOutcome"] =
      bm.winning_outcome === "OutcomeA" ? "YES"
      : bm.winning_outcome === "OutcomeB" ? "NO"
      : bm.winning_outcome === "Neither" ? "NEITHER"
      : null;

    const endDate = new Date(bm.settlement_deadline * 1000);
    const msLeft = endDate.getTime() - Date.now();
    const status: DisplayMarket["status"] = isSettled
      ? "resolved"
      : msLeft <= 3 * 24 * 60 * 60 * 1000
      ? "ending-soon"
      : "active";

    return {
      address: pdaAddress as string,
      marketId: bm.market_id,
      authority: bm.authority,
      collateralMint: bm.collateral_mint,
      outcomeYesMint: bm.outcome_yes_mint,
      outcomeNoMint: bm.outcome_no_mint,
      question: meta.question ?? `Market #${bm.market_id}`,
      yesPrice,
      noPrice,
      volume: 0, // not tracked in backend — would need on-chain for this
      endDate,
      isSettled,
      winningOutcome,
      status,
      metaDataUrl: bm.meta_data_url,
      image: meta.image ?? `https://picsum.photos/seed/${bm.market_id}/800/600`,
      category: meta.category ?? "General",
      description: meta.description ?? `On-chain prediction market #${bm.market_id}.`,
      resolutionCriteria: meta.resolutionCriteria ?? "Resolves based on on-chain settlement.",
      resolutionSource: meta.resolutionSource,
      participants: 0,
      videoId: meta.videoId,
      videoUrl: meta.videoUrl,
      channelName: meta.channelName,
      metric: meta.metric,
      target: meta.target,
      baselineValue: meta.baselineValue,
    };
  });

  const enriched: (DisplayMarket | null)[] = [];
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = await Promise.all(tasks.slice(i, i + BATCH_SIZE).map(fn => fn()));
    enriched.push(...batch);
    if (i + BATCH_SIZE < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return (enriched.filter(Boolean) as DisplayMarket[]).sort((a, b) => a.marketId - b.marketId);
}

/**
 * Fetches a single market from the **backend** (no Solana RPC).
 */
export async function fetchDisplayMarketByIdFromBackend(marketId: number): Promise<DisplayMarket | null> {
  let bm;
  try {
    bm = await fetchBackendMarket(marketId);
  } catch (e) {
    // Only treat 404 as "not found" — rethrow everything else (network errors, 500s, wrong URL)
    // so callers get a real error instead of a silent "Market Not Found" screen.
    if (e instanceof Error && e.message.includes('404')) return null;
    throw e;
  }

  const [pdaAddress, orderbookResult, meta] = await Promise.all([
    deriveMarketPDA(bm.market_id),
    fetchBackendOrderbook(bm.market_id).catch(() => null),
    tryFetchMetadata(bm.meta_data_url),
  ]);

  const { yesPrice, noPrice } = orderbookResult
    ? derivePriceFromBackendBook(orderbookResult)
    : { yesPrice: 0.5, noPrice: 0.5 };

  const isSettled = bm.status === "Settled" || bm.status === "Closed";
  const winningOutcome: DisplayMarket["winningOutcome"] =
    bm.winning_outcome === "OutcomeA" ? "YES"
    : bm.winning_outcome === "OutcomeB" ? "NO"
    : bm.winning_outcome === "Neither" ? "NEITHER"
    : null;

  const endDate = new Date(bm.settlement_deadline * 1000);
  const msLeft = endDate.getTime() - Date.now();
  const status: DisplayMarket["status"] = isSettled
    ? "resolved"
    : msLeft <= 3 * 24 * 60 * 60 * 1000
    ? "ending-soon"
    : "active";

  return {
    address: pdaAddress as string,
    marketId: bm.market_id,
    authority: bm.authority,
    collateralMint: bm.collateral_mint,
    outcomeYesMint: bm.outcome_yes_mint,
    outcomeNoMint: bm.outcome_no_mint,
    question: meta.question ?? `Market #${bm.market_id}`,
    yesPrice,
    noPrice,
    volume: 0,
    endDate,
    isSettled,
    winningOutcome,
    status,
    metaDataUrl: bm.meta_data_url,
    image: meta.image ?? `https://picsum.photos/seed/${bm.market_id}/800/600`,
    category: meta.category ?? "General",
    description: meta.description ?? `On-chain prediction market #${bm.market_id}.`,
    resolutionCriteria: meta.resolutionCriteria ?? "Resolves based on on-chain settlement.",
    resolutionSource: meta.resolutionSource,
    participants: 0,
    videoId: meta.videoId,
    videoUrl: meta.videoUrl,
    channelName: meta.channelName,
    metric: meta.metric,
    target: meta.target,
    baselineValue: meta.baselineValue,
  };
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
