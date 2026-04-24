# Stanx (Real-Time Prediction Market on Solana)

> Bet on anything. Trade like a pro. Settle on-chain.

Stanx is a fully on-chain, real-time prediction market built on Solana. Think of it as a stock exchange for opinions - users place YES/NO orders on any question ("Will Bitcoin hit $100k?"), orders get matched peer-to-peer, and winners claim their rewards trustlessly via smart contract.

The entire system - from the Solana smart contract to the live orderbook streaming on your screen - is built in Rust, with a Next.js frontend delivering sub-second UI updates without any polling.

---

## What Makes This Different

Most prediction markets are AMM-based (automated market makers with fixed price curves). Stanx runs a **central limit order book (CLOB)** - the same model used by professional trading exchanges. Users set their own prices, orders match peer-to-peer, and the book is always live.

The engineering challenge: making the orderbook feel instant across many concurrent users, while all settlement happens on a blockchain with ~400ms finality. The architecture solves this with a diff-based WebSocket protocol - only what changed is ever sent over the wire.

---

## Architecture Overview
<img width="1273" height="611" alt="Screenshot 2026-04-24 at 4 58 58 AM" src="https://github.com/user-attachments/assets/9508164e-981e-4436-92df-1f1af33ba147" />

```
Solana Blockchain
      │  (Anchor program emits events)
      ▼
Event Listener  ──────────────►  PostgreSQL  (source of truth)
  (Rust · Tokio)                     │
      │                              │
      └──►  Redis Pub/Sub  ◄─────────┘
                │
                ▼
           Backend  (Axum · port 3003)
           ├── In-memory orderbook (Arc swap, lock-free reads)
           ├── REST API  (/markets, /orderbook, /trades, /user)
           └── WebSocket streams
                 ├── WS 1: Orderbook diffs  →  live orderbook
                 └── WS 2: Trade ticks     →  live price chart
                          │
                          ▼
                     Frontend  (Next.js)
```

**End-to-end latency (happy path):**
Solana slot (~400ms) + indexer decode (<5ms) + Redis (<1ms) + broadcast (<1ms) = **~400ms**

---

## System Components

### Solana Smart Contract (Anchor)

The on-chain program handles all financial logic. Nothing can be faked - every order, match, and payout is verified and recorded on Solana.

| Instruction | What it does |
|---|---|
| `place_order` | Submit a limit order to the book |
| `cancel_order` | Cancel an open order and unlock funds |
| `match_orders` | Permissionlessly match two crossing orders |
| `claim_rewards` | Withdraw winnings after market resolution |
| `split_tokens` | Split a USDC token into YES + NO tokens |
| `merge_tokens` | Merge YES + NO tokens back into USDC |
| `set_winner` | Oracle sets which side won |
| `close_market` | Finalize and close the market |

### Event Listener (Rust · Tokio)

The indexer watches the Solana blockchain and reacts to every event in real time.

- **Live mode** - subscribes to `logsSubscribe` on Solana WebSocket RPC, auto-reconnects with exponential backoff
- **Helius fallback** - accepts webhook POSTs on port 3004 as a secondary source (or primary via `HELIUS_WEBHOOK_ONLY=true`)
- **Startup backfill** - on restart, reads the last indexed transaction from PostgreSQL and replays any missed events from Solana RPC history - no gaps
- **Heartbeat** - writes a Unix timestamp to `indexer:heartbeat` in Redis every 10 seconds so the backend can expose liveness on `/health`

Decoding pipeline: `raw log → strip prefix → Base64 decode → Borsh deserialize → match 8-byte Anchor discriminator → typed Rust event struct`

### Data Stores

| Store | Role |
|---|---|
| **PostgreSQL** | Persistent source of truth - markets, orders, trades, users, cursor |
| **Redis** | Volatile pub/sub bus - `orderbook:market:{id}` and `trades:market:{id}` channels |

### Backend (Axum · Tokio · port 3003)

On startup, the backend loads all active markets from Postgres, builds an in-memory `OrderbookState` for each, and creates broadcast channels. A background receiver task subscribes to Redis and fans out updates to all connected WebSocket clients.

**REST API**

| Endpoint | Description |
|---|---|
| `GET /health` | Indexer liveness check |
| `POST /signup` · `POST /signin` | JWT authentication |
| `GET /markets` | All open markets |
| `GET /markets/:id` | Single market detail |
| `GET /markets/:id/orderbook` | Full orderbook snapshot |
| `GET /markets/:id/trades` | Historical trades |
| `GET /markets/:id/orders/:pubkey` | User's open orders |
| `GET /markets/:id/prices` | Price history |
| `GET /markets/:id/resolution` | Market resolution result |
| `GET /user/:pubkey/markets` | Markets a user participated in |
| `GET /user/:pubkey/trades` | User's full trade history |

**WebSocket Streams**

```
WS /ws/:market_id
  → on connect: full OrderbookState snapshot
  → on every trade: OrderbookDiff (only what changed)
  → if client lags: re-send full snapshot to re-sync

WS /ws/price/:market_id?token=yes|no
  → one message per trade: { timestamp, price }
  → frontend appends each point to the live chart
```

### Frontend (Next.js · TypeScript · Tailwind)

The UI is a standard Next.js app. It connects to the backend over HTTP for initial data, then switches to WebSockets for all live updates.

| Page | What it shows |
|---|---|
| `/` | Market discovery feed with search and filters |
| `/market/:id` | Live orderbook, trading panel, price chart, order history |
| `/portfolio` | User's open positions and trade history |
| `/account` | Profile and wallet settings |
| `/create-market` | Admin interface to launch a new market |

Key libraries: `@solana/kit` for wallet integration, `recharts` for price charts, `shadcn/ui` for components, `TanStack Query` for data fetching.

---

## Design Decisions

### Diffs, Not Snapshots

After the first connection, the backend never sends the full orderbook again. Every subsequent message is an `OrderbookDiff` - added orders, removed orders, partially filled orders. With 1000 clients watching the same market, there is one Redis message per trade fanned out internally - not 1000 Postgres queries.

### Lock-Free In-Memory Orderbook

The backend keeps a `HashMap<market_id, Arc<OrderbookState>>` in memory. Reads are lock-free (clone the Arc). Writes do an atomic pointer swap - readers in flight keep their old snapshot, nobody blocks.

### Compile-Time SQL Verification (SQLx)

Every SQL query is checked against a real database schema at compile time via `.sqlx` cache files. A schema mismatch is a **build error**, not a runtime panic at 3 AM.

### Backfill on Restart

The cursor table in Postgres stores the last indexed transaction signature. On restart, the event listener replays everything between the cursor and the chain tip. Zero data loss across deploys.

---

## Repository Layout

```
prediction-market/          ← this repo (frontend)
├── app/                    Next.js pages (App Router)
│   ├── page.tsx            Market feed
│   ├── market/[id]/        Live trading page
│   ├── portfolio/          User portfolio
│   ├── account/            Account settings
│   └── create-market/      Market creation (admin)
├── components/             Shared UI components
│   ├── TradingPanelNew.tsx  Order placement UI
│   ├── OrderBook.tsx        Live orderbook display
│   ├── TradingChartRecharts.tsx  Price chart
│   ├── UserStatsCard.tsx    Portfolio stats
│   └── Header.tsx           Navigation
├── hooks/                  Custom React hooks
├── lib/                    Utilities, design system
└── types/                  TypeScript types

stanx-backend/              ← https://github.com/yashop7/StanX-backend/
├── backend/                Axum HTTP + WebSocket server (port 3003)
├── event-listener/         Solana event indexer
├── db/                     SQLx query definitions
├── common/                 Shared types (OrderbookState, Diff, TradeTick)
└── ws/                     Actix-ws room server (port 3000)
```

> The backend lives in a separate repo: **[yashop7/StanX-backend](https://github.com/yashop7/StanX-backend/)** - Rust workspace containing the Axum API server, Solana event indexer, WebSocket streams, and all shared types.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Solana + Anchor |
| Smart contract serialization | Borsh + Base64 |
| Indexer | Solana WebSocket RPC + Helius webhooks |
| Backend HTTP/WS | Axum (Tokio) |
| Async runtime | Tokio |
| Database | PostgreSQL via SQLx (compile-time verified) |
| Pub/Sub | Redis |
| Auth | JWT (Solana pubkey-based) |
| ID generation | Snowflake IDs |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Wallet | `@solana/kit` |
| Charts | Recharts |
| UI components | shadcn/ui |

---

## Getting Started (Frontend)

**Prerequisites:** Node.js 18+, Bun, a Solana wallet (Phantom / Backpack)

```bash
# Clone and install
git clone https://github.com/your-org/prediction-market
cd prediction-market
bun install

# Set environment variables
cp .env.local.example .env.local
# Add your RPC endpoint and backend URL

# Start development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

**Environment variables**

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3003
NEXT_PUBLIC_WS_URL=ws://localhost:3003
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
```

---

## Port Reference

| Service | Port | Protocol |
|---|---|---|
| Backend API + WebSocket | 3003 | HTTP + WS |
| WS room server | 3000 | WebSocket |
| Helius webhook receiver | 3004 | HTTP POST |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push and open a pull request

Please follow the existing code style. Run `bun run lint && bun run format:check` before submitting.

---

## License

MIT - see [LICENSE](LICENSE) for details.

---

_Built with Rust, Solana, and a lot of care for latency._
