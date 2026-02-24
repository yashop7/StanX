import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from "@solana/kit";

/**
 * HTTP RPC client — use for sending transactions, fetching accounts, etc.
 */
export const rpc = createSolanaRpc("https://api.devnet.solana.com");

/**
 * WebSocket subscriptions client — used by sendAndConfirmTransaction internally.
 */
export const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");
