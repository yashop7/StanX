import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from "@solana/kit";

// Priority: custom env var → public devnet fallback
// To avoid 429 rate-limits, set NEXT_PUBLIC_SOLANA_RPC_URL in .env.local
// e.g. a free Helius devnet key: https://devnet.helius-rpc.com/?api-key=YOUR_KEY
const RPC_URL  = process.env.NEXT_PUBLIC_SOLANA_RPC_URL  ?? "https://api.devnet.solana.com";
const RPC_WSS  = process.env.NEXT_PUBLIC_SOLANA_RPC_WSS  ?? "wss://api.devnet.solana.com";

/**
 * HTTP RPC client — use for sending transactions, fetching accounts, etc.
 */
export const rpc = createSolanaRpc(RPC_URL);

/**
 * WebSocket subscriptions client — used by sendAndConfirmTransaction internally.
 */
export const rpcSubscriptions = createSolanaRpcSubscriptions(RPC_WSS);
