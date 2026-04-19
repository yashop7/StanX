/**
 * StanX Backend REST API client
 *
 * Browser  → calls /api/backend/* (Next.js rewrites proxy to localhost:3003, no CORS)
 * Server   → calls localhost:3003 directly (server-to-server, no CORS)
 */

const BASE_URL =
  typeof window !== 'undefined'
    ? '/api/backend'   // client: go through Next.js proxy to avoid CORS
    : (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3003').replace(/\/$/, '');


export interface BackendOrder {
  order_id: number;
  market_id: number;
  user_pubkey: string;
  side: 'Buy' | 'Sell';
  token_type: 'Yes' | 'No';
  /** Price in basis points (0–100). e.g. 65 = 65¢ */
  price: number;
  original_quantity: number;
  remaining_quantity: number;
  status: 'Open' | 'PartiallyFilled' | 'Filled' | 'Cancelled';
  /** Unix timestamp (seconds) */
  placed_at: number;
  updated_at: string;
}

export interface BackendMarket {
  market_id: number;
  authority: string;
  /** Unix timestamp when market closes */
  settlement_deadline: number;
  collateral_mint: string;
  outcome_yes_mint: string;
  outcome_no_mint: string;
  meta_data_url: string;
  status: 'Active' | 'Settled' | 'Closed';
  winning_outcome: 'OutcomeA' | 'OutcomeB' | 'Neither' | null;
  created_at: string;
  updated_at: string;
}

export interface BackendTrade {
  id: number;
  signature: string;
  market_id: number;
  maker_order_id: number;
  taker_side: 'Buy' | 'Sell';
  taker: string;
  maker: string;
  token_type: 'Yes' | 'No';
  /** Price in basis points (0–100) */
  price: number;
  quantity: number;
  /** Unix timestamp from Solana block */
  event_timestamp: number;
  created_at: string;
}

/** Full orderbook snapshot — sent by WebSocket on first connect or lag resync */
export interface OrderbookSnapshot {
  slot: number;
  market_id: number;
  yes_bids: BackendOrder[]; // sorted price DESC
  yes_asks: BackendOrder[]; // sorted price ASC
  no_bids: BackendOrder[];  // sorted price DESC
  no_asks: BackendOrder[];  // sorted price ASC
}

/** Incremental diff — sent by WebSocket on every change */
export interface OrderbookDiff {
  slot: number;
  market_id: number;
  yes_bids_added: BackendOrder[];
  yes_bids_removed: number[];
  yes_asks_added: BackendOrder[];
  yes_asks_removed: number[];
  no_bids_added: BackendOrder[];
  no_bids_removed: number[];
  no_asks_added: BackendOrder[];
  no_asks_removed: number[];
}


// ─── Price / Quantity scaling ──────────────────────────────────────────────────
// Backend prices are on-chain micro-units (0–1_000_000), NOT "65 = 65%" as docs say.
// 500_000 → 50% → display as 50¢  →  divide by 10_000
// Quantities are on-chain base units: 1_000_000 base units = 1 share
export const BACKEND_PRICE_SCALE = 10_000;
export const BACKEND_QTY_SCALE   = 1_000_000;

export function toDisplayPrice(microPrice: number): number {
  return microPrice / BACKEND_PRICE_SCALE;
}
export function toDisplayQty(baseUnits: number): number {
  return baseUnits / BACKEND_QTY_SCALE;
}


async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Backend ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}


export async function signup(username: string, password: string): Promise<{ id: string }> {
  const res = await fetch(`${BASE_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`signup failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function signin(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${BASE_URL}/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`signin failed (${res.status}): ${text}`);
  }
  return res.json();
}


/** GET /markets — list all active markets */
export async function fetchBackendMarkets(): Promise<BackendMarket[]> {
  return get<BackendMarket[]>('/markets');
}

/** GET /markets/:id — single market */
export async function fetchBackendMarket(marketId: number): Promise<BackendMarket> {
  return get<BackendMarket>(`/markets/${marketId}`);
}

export type PricePeriod = '1H' | '6H' | '1D' | '1W' | '1M' | '3M' | 'ALL';

/** A single OHLC bucket from the prices endpoint */
export interface PricePoint {
  /** Unix timestamp in milliseconds */
  t: number;
  /** Raw on-chain price string — divide by BACKEND_PRICE_SCALE to get 0→1 probability */
  p: string;
}

/**
 * GET /markets/{market_id}/prices?token=yes|no&period=1H|6H|1D|1W|1M|3M|ALL
 * Returns { history: PricePoint[] } sorted oldest → newest.
 */
export async function fetchMarketPrices(
  marketId: number,
  token: 'yes' | 'no' = 'yes',
  period: PricePeriod = '1D',
): Promise<PricePoint[]> {
  const res = await get<{ history: PricePoint[] }>(`/markets/${marketId}/prices?token=${token}&period=${period}`);
  return res.history ?? [];
}


interface RestOrderbookResponse {
  market_id: number;
  yes_buy_orders: BackendOrder[];
  yes_sell_orders: BackendOrder[];
  no_buy_orders: BackendOrder[];
  no_sell_orders: BackendOrder[];
}

/** GET /markets/:id/orderbook, REST snapshot (fallback; prefer WebSocket) */
export async function fetchBackendOrderbook(marketId: number): Promise<RestOrderbookResponse> {
  return get<RestOrderbookResponse>(`/markets/${marketId}/orderbook`);
}


/** GET /markets/:id/trades?limit=N, recent trades for a market */
export async function fetchMarketTrades(marketId: number, limit = 50): Promise<BackendTrade[]> {
  return get<BackendTrade[]>(`/markets/${marketId}/trades?limit=${Math.min(limit, 200)}`);
}

/** GET /markets/:id/orders/:pubkey, all orders by a user in a market */
export async function fetchUserMarketOrders(
  marketId: number,
  userPubkey: string,
): Promise<BackendOrder[]> {
  return get<BackendOrder[]>(`/markets/${marketId}/orders/${userPubkey}`);
}

/** GET /user/:pubkey/trades?limit=N, all trades by a user across all markets */
export async function fetchUserTrades(userPubkey: string, limit = 50): Promise<BackendTrade[]> {
  return get<BackendTrade[]>(`/user/${userPubkey}/trades?limit=${Math.min(limit, 200)}`);
}

/** GET /user/:pubkey/markets, all markets created/initialized by this user */
export async function fetchUserCreatedMarkets(userPubkey: string): Promise<BackendMarket[]> {
  return get<BackendMarket[]>(`/user/${userPubkey}/markets`);
}

export interface IndexerHealth {
  indexer_ok: boolean;
  last_heartbeat: number;
  seconds_since_heartbeat: number;
}

/** GET /health, checks if the indexer is alive and writing heartbeats */
export async function fetchIndexerHealth(): Promise<IndexerHealth> {
  const res = await fetch(`${BASE_URL}/health`, { cache: 'no-store' });
  if (!res.ok) {
    return { indexer_ok: false, last_heartbeat: 0, seconds_since_heartbeat: 0 };
  }
  return res.json() as Promise<IndexerHealth>;
}

/** Returns the WebSocket URL for a market's live orderbook.
 *  WebSocket always connects directly to the backend (not proxied). */
export function getOrderbookWsUrl(marketId: number): string {
  const directUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3003').replace(/\/$/, '');
  const wsBase = directUrl.replace(/^http/, 'ws');
  return `${wsBase}/ws/${marketId}`;
}


export interface VideoPreview {
  video_id: string;
  title: string;
  thumbnail: string;
  channel_name: string;
  current_views: number;
  current_likes: number;
  current_comments: number;
  published_at: string;
}

/**
 * POST /markets/preview, fetch YouTube video stats for market creation.
 * Returns video metadata + current stats so the user can set a realistic target.
 */
export async function fetchVideoPreview(url: string): Promise<VideoPreview> {
  const res = await fetch(`${BASE_URL}/markets/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (res.status === 400) throw new Error('Please paste a valid YouTube URL');
  if (res.status === 404) throw new Error('Video not found');
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Preview failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<VideoPreview>;
}

// Market Resolution

export interface MarketResolution {
  market_id: number;
  outcome: 'OutcomeA' | 'OutcomeB';
  actual_value: number;
  threshold: number;
  metric: string;
  video_id: string;
  resolved_at: string;
}

/**
 * GET /markets/:id/resolution, fetch oracle-computed resolution for a settled market.
 * Returns null if the oracle hasn't computed the result yet.
 */
export async function fetchMarketResolution(marketId: number): Promise<MarketResolution | null> {
  const res = await fetch(`${BASE_URL}/markets/${marketId}/resolution`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Resolution fetch failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<MarketResolution>;
}
