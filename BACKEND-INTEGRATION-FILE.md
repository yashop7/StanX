# StanX Backend — Frontend Integration Guide

> **Base URL:** `http://<host>:3003`
> **WebSocket Base:** `ws://<host>:3003`
> **All responses are JSON. All request bodies must be `Content-Type: application/json`.**

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Types Reference](#data-types-reference)
3. [Auth Endpoints](#auth-endpoints)
4. [Market Endpoints](#market-endpoints)
5. [WebSocket — Live Orderbook](#websocket--live-orderbook)
6. [How to Build the Orderbook in the Frontend](#how-to-build-the-orderbook-in-the-frontend)
7. [Error Handling](#error-handling)
8. [Quick Reference — All Endpoints](#quick-reference--all-endpoints)

---

## Architecture Overview

```
Solana Chain
     │  (on-chain events)
     ▼
Event Listener  ──► Postgres (live_orders, trades, markets)
     │
     │  Redis Pub/Sub  (orderbook:market:<id>)
     ▼
Backend Server
     ├── REST API  ──► Frontend (HTTP)
     └── WebSocket ──► Frontend (real-time diffs)
```

**How real-time data flows to you:**

1. A user places/cancels/fills an order on-chain.
2. The event-listener picks it up, writes to Postgres, and publishes an **orderbook diff** to Redis.
3. The backend receives that diff and broadcasts it to all connected WebSocket clients for that market.
4. Your frontend receives either:
   - A **full snapshot** (on first connect, or if you lag too far behind), or
   - A **diff** (incremental update — just what changed).

You maintain your own local copy of the orderbook and apply diffs to it. This keeps the UI snappy without re-fetching everything on every trade.

---

## Data Types Reference

These are the exact JSON shapes you will see across all endpoints and WebSocket messages.

### `Order` object

```json
{
  "order_id": 42,
  "market_id": 1,
  "user_pubkey": "7xKXtg2CW...Fz3",
  "side": "Buy",
  "token_type": "Yes",
  "price": 65,
  "original_quantity": 100,
  "remaining_quantity": 60,
  "status": "PartiallyFilled",
  "placed_at": 1710000000,
  "updated_at": "2024-03-10T08:00:00Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `order_id` | `number` | Unique per market. |
| `market_id` | `number` | The market this order belongs to. |
| `user_pubkey` | `string` | Solana wallet address of the order owner. |
| `side` | `"Buy"` \| `"Sell"` | |
| `token_type` | `"Yes"` \| `"No"` | Which outcome token. |
| `price` | `number` | Price in basis points (e.g. `65` = 65%). |
| `original_quantity` | `number` | Quantity when first placed. |
| `remaining_quantity` | `number` | How much is still open. |
| `status` | `"Open"` \| `"PartiallyFilled"` \| `"Filled"` \| `"Cancelled"` | |
| `placed_at` | `number` | Unix timestamp (seconds). |
| `updated_at` | `string` | ISO 8601 datetime. |

---

### `Market` object

```json
{
  "market_id": 1,
  "authority": "9xKXtg...authority",
  "settlement_deadline": 1720000000,
  "collateral_mint": "EPjFWdd5...USDC",
  "outcome_yes_mint": "AbcDef...YesMint",
  "outcome_no_mint": "GhiJkl...NoMint",
  "meta_data_url": "https://example.com/market/1/meta.json",
  "status": "Active",
  "winning_outcome": null,
  "created_at": "2024-03-01T00:00:00Z",
  "updated_at": "2024-03-01T00:00:00Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `market_id` | `number` | Unique market identifier. |
| `authority` | `string` | Admin/creator wallet. |
| `settlement_deadline` | `number` | Unix timestamp when market closes. |
| `collateral_mint` | `string` | SPL token used as collateral (e.g. USDC). |
| `outcome_yes_mint` | `string` | SPL token for YES outcome shares. |
| `outcome_no_mint` | `string` | SPL token for NO outcome shares. |
| `meta_data_url` | `string` | URL to off-chain metadata (title, description, image). |
| `status` | `"Active"` \| `"Settled"` \| `"Closed"` | |
| `winning_outcome` | `"OutcomeA"` \| `"OutcomeB"` \| `"Neither"` \| `null` | `null` until market is settled. |
| `created_at` | `string` | ISO 8601. |
| `updated_at` | `string` | ISO 8601. |

---

### `Trade` object

```json
{
  "id": 1,
  "signature": "5KtbQ...txsig",
  "market_id": 1,
  "maker_order_id": 7,
  "taker_side": "Buy",
  "taker": "7xKXtg...taker",
  "maker": "9mNbP...maker",
  "token_type": "Yes",
  "price": 65,
  "quantity": 40,
  "event_timestamp": 1710000500,
  "created_at": "2024-03-10T08:01:00Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `taker_side` | `"Buy"` \| `"Sell"` | Side from the taker's perspective. |
| `price` | `number` | Price in basis points. |
| `quantity` | `number` | Filled quantity. |
| `event_timestamp` | `number` | Unix timestamp from the Solana block. |

---

### `OrderbookSnapshot` (WebSocket — first message)

Sent immediately when you connect. This is the full current state.

```json
{
  "slot": 280001234,
  "market_id": 1,
  "yes_bids": [ /* Order objects — sorted price DESC */ ],
  "yes_asks": [ /* Order objects — sorted price ASC  */ ],
  "no_bids":  [ /* Order objects — sorted price DESC */ ],
  "no_asks":  [ /* Order objects — sorted price ASC  */ ]
}
```

| Field | Notes |
|---|---|
| `slot` | Solana slot at which this snapshot is current. |
| `yes_bids` | Buyers of YES tokens. Highest price first. |
| `yes_asks` | Sellers of YES tokens. Lowest price first. |
| `no_bids` | Buyers of NO tokens. Highest price first. |
| `no_asks` | Sellers of NO tokens. Lowest price first. |

---

### `OrderbookDiff` (WebSocket — subsequent messages)

Sent every time something changes. Only the changed parts are included.

```json
{
  "slot": 280001240,
  "market_id": 1,
  "yes_bids_added":   [ /* Order objects to insert/update */ ],
  "yes_bids_removed": [ 12, 45 ],
  "yes_asks_added":   [ /* Order objects */ ],
  "yes_asks_removed": [],
  "no_bids_added":    [],
  "no_bids_removed":  [],
  "no_asks_added":    [],
  "no_asks_removed":  []
}
```

| Field | Type | Notes |
|---|---|---|
| `*_added` | `Order[]` | Orders to insert. If an order with this `order_id` already exists locally, **replace** it (partial fill update). |
| `*_removed` | `number[]` | `order_id`s to delete from your local state. |
| `slot` | `number` | The Solana slot for this update. |

> **Important:** An `_added` entry for an existing `order_id` means the order was **partially filled** — replace the old entry with the new one (remaining_quantity has decreased).

---

## Auth Endpoints

### `POST /signup`

Create a new account.

**Request body:**
```json
{
  "username": "alice",
  "password": "hunter2"
}
```

**Response `200`:**
```json
{
  "id": "uuid-string"
}
```

**Errors:**
- `409 Conflict` — username already taken.

---

### `POST /signin`

Sign in and get a JWT.

**Request body:**
```json
{
  "username": "alice",
  "password": "hunter2"
}
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `401 Unauthorized` — wrong username or password.

> The JWT is for backend auth (user identity). Actual trades are submitted directly to Solana — the JWT identifies who you are on the backend but does not sign transactions.

---

## Market Endpoints

### `GET /markets`

List all **active** markets.

**Response `200`:**
```json
[
  {
    "market_id": 1,
    "authority": "9xKX...",
    "settlement_deadline": 1720000000,
    "collateral_mint": "EPjF...",
    "outcome_yes_mint": "AbcD...",
    "outcome_no_mint": "GhiJ...",
    "meta_data_url": "https://...",
    "status": "Active",
    "winning_outcome": null,
    "created_at": "2024-03-01T00:00:00Z",
    "updated_at": "2024-03-01T00:00:00Z"
  }
]
```

---

### `GET /markets/:market_id`

Get a single market by ID.

**Example:** `GET /markets/1`

**Response `200`:** Single `Market` object (same shape as above).

**Errors:**
- `404 Not Found` — market does not exist.

---

### `GET /markets/:market_id/orderbook`

Get the full orderbook for a market from the database.

> **Use this as a fallback only.** For live data, use the WebSocket — it's faster and real-time. This endpoint is useful for server-side rendering, initial page load without WebSocket, or debugging.

**Example:** `GET /markets/1/orderbook`

**Response `200`:**
```json
{
  "market_id": 1,
  "yes_buy_orders": [ /* Order objects, price DESC */ ],
  "yes_sell_orders": [ /* Order objects, price ASC  */ ],
  "no_buy_orders":  [ /* Order objects, price DESC */ ],
  "no_sell_orders": [ /* Order objects, price ASC  */ ]
}
```

> Note: key names here (`yes_buy_orders`) differ from WebSocket snapshot (`yes_bids`). They contain the same data.

---

### `GET /markets/:market_id/trades?limit=50`

Get recent trades for a market.

**Query params:**
| Param | Default | Max | Notes |
|---|---|---|---|
| `limit` | `50` | `200` | Number of trades to return. |

**Example:** `GET /markets/1/trades?limit=20`

**Response `200`:** Array of `Trade` objects, sorted by `event_timestamp DESC` (newest first).

```json
[
  {
    "id": 55,
    "signature": "5Ktb...",
    "market_id": 1,
    "maker_order_id": 12,
    "taker_side": "Buy",
    "taker": "7xKX...",
    "maker": "9mNb...",
    "token_type": "Yes",
    "price": 65,
    "quantity": 40,
    "event_timestamp": 1710000500,
    "created_at": "2024-03-10T08:01:00Z"
  }
]
```

---

### `GET /markets/:market_id/orders/:user_pubkey`

Get all orders (any status) for a specific user in a specific market.

**Example:** `GET /markets/1/orders/7xKXtg2CW...Fz3`

**Response `200`:** Array of `Order` objects, sorted by `placed_at DESC` (newest first).

```json
[
  {
    "order_id": 42,
    "market_id": 1,
    "user_pubkey": "7xKXtg2CW...Fz3",
    "side": "Buy",
    "token_type": "Yes",
    "price": 65,
    "original_quantity": 100,
    "remaining_quantity": 60,
    "status": "PartiallyFilled",
    "placed_at": 1710000000,
    "updated_at": "2024-03-10T08:00:00Z"
  }
]
```

> This returns all statuses including `Filled` and `Cancelled` — useful for "My Orders" history page.

---

### `GET /user/:user_pubkey/trades?limit=50`

Get trade history for a user across **all** markets.

**Query params:**
| Param | Default | Max |
|---|---|---|
| `limit` | `50` | `200` |

**Example:** `GET /user/7xKXtg2CW...Fz3/trades?limit=10`

**Response `200`:** Array of `Trade` objects (newest first), where `taker = user_pubkey OR maker = user_pubkey`.

---

## WebSocket — Live Orderbook

### Connect

```
ws://<host>:3003/ws/:market_id
```

**Example:**
```
ws://localhost:3003/ws/1
```

No auth header needed to subscribe. The connection is per-market — open one connection per market you want to watch.

---

### Message Flow

```
Client                          Server
  │                               │
  │── WS Upgrade ──────────────►  │
  │                               │
  │◄── OrderbookSnapshot ─────────│  (full state, sent immediately on connect)
  │                               │
  │◄── OrderbookDiff ─────────────│  (every time something changes)
  │◄── OrderbookDiff ─────────────│
  │◄── OrderbookDiff ─────────────│
  │        ...                    │
  │                               │
  │  (if client lags too far)     │
  │◄── OrderbookSnapshot ─────────│  (full resync, starts over)
  │◄── OrderbookDiff ─────────────│
  │        ...                    │
```

### How to tell apart a Snapshot vs Diff

Both are JSON objects. Check for the presence of the `yes_bids` key:

```js
const msg = JSON.parse(event.data);

if ('yes_bids' in msg) {
  // Full snapshot — replace your entire local orderbook
  applySnapshot(msg);
} else {
  // Diff — apply incremental update
  applyDiff(msg);
}
```

---

## How to Build the Orderbook in the Frontend

Here is a complete reference implementation in TypeScript:

```typescript
// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  order_id: number;
  market_id: number;
  user_pubkey: string;
  side: 'Buy' | 'Sell';
  token_type: 'Yes' | 'No';
  price: number;
  original_quantity: number;
  remaining_quantity: number;
  status: 'Open' | 'PartiallyFilled' | 'Filled' | 'Cancelled';
  placed_at: number;
  updated_at: string;
}

interface OrderbookSnapshot {
  slot: number;
  market_id: number;
  yes_bids: Order[];
  yes_asks: Order[];
  no_bids:  Order[];
  no_asks:  Order[];
}

interface OrderbookDiff {
  slot: number;
  market_id: number;
  yes_bids_added:   Order[];
  yes_bids_removed: number[];
  yes_asks_added:   Order[];
  yes_asks_removed: number[];
  no_bids_added:    Order[];
  no_bids_removed:  number[];
  no_asks_added:    Order[];
  no_asks_removed:  number[];
}

// ─── Local State ──────────────────────────────────────────────────────────────

let orderbook: OrderbookSnapshot = {
  slot: 0,
  market_id: 0,
  yes_bids: [],
  yes_asks: [],
  no_bids:  [],
  no_asks:  [],
};

// ─── Apply Helpers ────────────────────────────────────────────────────────────

function applySnapshot(snap: OrderbookSnapshot) {
  orderbook = { ...snap };
  renderOrderbook(); // your UI update function
}

function applySide(
  current: Order[],
  added: Order[],
  removed: number[],
  sortDesc: boolean,
): Order[] {
  // 1. Remove all IDs that are in `removed` OR in `added`
  //    (added entries replace existing ones — partial fill update)
  const addedIds = new Set(added.map(o => o.order_id));
  const removedIds = new Set(removed);
  let result = current.filter(
    o => !removedIds.has(o.order_id) && !addedIds.has(o.order_id)
  );

  // 2. Insert new/updated orders
  result = result.concat(added);

  // 3. Re-sort
  result.sort((a, b) => sortDesc ? b.price - a.price : a.price - b.price);
  return result;
}

function applyDiff(diff: OrderbookDiff) {
  orderbook.yes_bids = applySide(orderbook.yes_bids, diff.yes_bids_added, diff.yes_bids_removed, true);
  orderbook.yes_asks = applySide(orderbook.yes_asks, diff.yes_asks_added, diff.yes_asks_removed, false);
  orderbook.no_bids  = applySide(orderbook.no_bids,  diff.no_bids_added,  diff.no_bids_removed,  true);
  orderbook.no_asks  = applySide(orderbook.no_asks,  diff.no_asks_added,  diff.no_asks_removed,  false);
  orderbook.slot     = diff.slot;
  renderOrderbook();
}

// ─── WebSocket Connection ─────────────────────────────────────────────────────

function connectOrderbook(marketId: number) {
  const ws = new WebSocket(`ws://localhost:3003/ws/${marketId}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    // Snapshot has `yes_bids`; Diff has `yes_bids_added`
    if ('yes_bids' in msg) {
      applySnapshot(msg as OrderbookSnapshot);
    } else {
      applyDiff(msg as OrderbookDiff);
    }
  };

  ws.onclose = () => {
    // Reconnect after 2 seconds
    setTimeout(() => connectOrderbook(marketId), 2000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    ws.close();
  };

  return ws;
}

// ─── Usage ────────────────────────────────────────────────────────────────────

connectOrderbook(1);
```

---

### What triggers each type of WebSocket message

| On-chain action | What you receive |
|---|---|
| Limit order placed | `yes_bids_added` or `yes_asks_added` or `no_bids_added` or `no_asks_added` (1 new order) |
| Limit order cancelled | `*_removed` (order_id removed from its side) |
| Market order fills a maker | `*_removed` (maker fully filled) or `*_removed` + `*_added` (maker partially filled — same id, lower remaining_quantity) |
| Limit-vs-limit match (taker side) | Same as above but both maker and taker may update |
| Lag resync | Full `OrderbookSnapshot` — replace everything |

---

### Price convention

Prices are integers representing **basis points** / percentage:
- `65` means **65%**
- `34` means **34%**
- YES and NO prices don't need to sum to 100 (CLOB, not AMM).

---

## Error Handling

All REST errors return:

```json
"Error message as plain string"
```

with the appropriate HTTP status code.

| HTTP Status | Meaning |
|---|---|
| `200` | Success |
| `404` | Resource not found (market, order, user) |
| `401` | Wrong credentials (signin) |
| `409` | Conflict — duplicate (signup with taken username) |
| `500` | Server error |

---

## Quick Reference — All Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/signup` | Create account |
| `POST` | `/signin` | Get JWT token |
| `GET` | `/markets` | All active markets |
| `GET` | `/markets/:market_id` | Single market |
| `GET` | `/markets/:market_id/orderbook` | Static orderbook snapshot (DB) |
| `GET` | `/markets/:market_id/trades?limit=N` | Recent trades for a market |
| `GET` | `/markets/:market_id/orders/:user_pubkey` | All orders by user in market |
| `GET` | `/user/:user_pubkey/trades?limit=N` | All trades by user (all markets) |
| `WS` | `/ws/:market_id` | Live orderbook stream |

---

## Suggested Page-Level Data Strategy

| Page | Data source |
|---|---|
| Market list | `GET /markets` — poll every 30s or on mount |
| Market detail / orderbook | Connect WebSocket `/ws/:market_id` on mount, disconnect on unmount |
| Trade history feed | `GET /markets/:id/trades` — poll every 10s, or listen to WS (new trades arrive indirectly via orderbook changes) |
| My open orders | `GET /markets/:id/orders/:pubkey` — fetch on mount, re-fetch after any Solana tx confirmation |
| My trade history | `GET /user/:pubkey/trades` |
| Market settled / outcome | `GET /markets/:id` — the `status` and `winning_outcome` fields |
