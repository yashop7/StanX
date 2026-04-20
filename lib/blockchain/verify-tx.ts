import { rpc } from "./client";
import { fetchMarketTrades, fetchUserMarketOrders } from "@/lib/api/backend";

export type TxOutcome =
  | { kind: "success"; signature?: string }
  | { kind: "failed"; reason: string }
  | { kind: "cancelled" }
  | { kind: "pending"; hint: string };

export const PROGRAM_ERROR_MESSAGES: Record<number, string> = {
  0x1771: "Invalid settlement deadline",
  0x1772: "Market already settled",
  0x1773: "Market has expired",
  0x177a: "Market is not settled yet",
  0x177b: "Winning outcome is not set yet",
  0x1780: "Not authorized — wallet must be the market creator",
  0x178b: "Settlement deadline has not been reached yet",
};

// Solana Kit SDK error codes that wrap the real failure — map to human messages
const SOLANA_SDK_ERRORS: Record<number, string> = {
  7618003: "Transaction failed to send. The network may be congested — please try again.",
  7050003: "Transaction simulation failed. Check your balance and try again.",
  7050002: "Transaction could not be simulated.",
  6291456: "Transaction was not confirmed in time. Check your wallet history.",
};

function walkError<T>(
  err: unknown,
  pick: (o: Record<string, unknown>) => T | undefined,
): T | undefined {
  const seen = new Set<unknown>();
  const stack: unknown[] = [err];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    const obj = node as Record<string, unknown>;
    const result = pick(obj);
    if (result !== undefined) return result;
    if (obj.cause) stack.push(obj.cause);
    if (obj.context) stack.push(obj.context);
    if (obj.transactionPlanResult) stack.push(obj.transactionPlanResult);
  }
  return undefined;
}

// Only matches our Anchor program's custom error range (6000–6999).
// Ignores large Solana Kit SDK error codes (e.g. 7618003) that are wrapper errors.
export function extractProgramErrorCode(err: unknown): number | undefined {
  return walkError<number>(err, (o) => {
    if (typeof o.code !== "number") return undefined;
    const code = o.code;
    if (code >= 6000 && code <= 6999) return code;
    return undefined;
  });
}

// Returns the top-level Solana SDK error code if present (used for friendly messages).
function extractSolanaKitCode(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.code === "number" && obj.code > 6999) return obj.code;
  }
  return undefined;
}

export function extractSimLogs(err: unknown): string[] | undefined {
  return walkError<string[]>(err, (o) =>
    Array.isArray(o.logs) ? (o.logs as string[]) : undefined,
  );
}

export function extractSignature(err: unknown): string | undefined {
  const fromWalk = walkError<string>(err, (o) => {
    for (const key of ["signature", "txSignature", "transactionSignature"]) {
      if (typeof o[key] === "string" && (o[key] as string).length > 40)
        return o[key] as string;
    }
    return undefined;
  });
  if (fromWalk) return fromWalk;

  const msg = err instanceof Error ? err.message : "";
  const match = msg.match(/[1-9A-HJ-NP-Za-km-z]{87,88}/);
  return match?.[0];
}

export function isUserRejection(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("cancelled by user") ||
    msg.includes("rejected the request") ||
    msg.includes("request rejected")
  );
}

function isConfirmationTimeout(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("blockheight exceeded") ||
    msg.includes("transaction expired") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("not confirmed") ||
    msg.includes("was not confirmed")
  );
}

/** Strips raw Solana SDK error noise from a message string. */
function cleanErrorMessage(msg: string): string {
  // "Solana error #7618003; Decode this error by running..." → strip everything from ";"
  const semicolonIdx = msg.indexOf("; Decode this error");
  if (semicolonIdx !== -1) return msg.slice(0, semicolonIdx).trim();
  // "Solana error #XXXXXXX" with no friendly text → generic message
  if (/^Solana error #\d+/.test(msg)) return "Transaction failed. Please try again.";
  return msg;
}

async function fetchWithTimeout<T>(fn: () => Promise<T>, ms = 4_000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("fetch timeout")), ms),
    ),
  ]);
}

async function verifyViaBackend(
  marketId: number,
  userPubkey: string,
  orderStartTime: number,
  maxWaitMs = 12_000,
): Promise<{ found: boolean; signature?: string }> {
  const deadline = Date.now() + maxWaitMs;
  await new Promise((r) => setTimeout(r, 1_000));

  while (Date.now() < deadline) {
    try {
      const trades = await fetchWithTimeout(() => fetchMarketTrades(marketId, 30));
      const trade = trades.find(
        (t) =>
          t.taker === userPubkey &&
          t.event_timestamp >= orderStartTime - 60 &&
          t.event_timestamp <= orderStartTime + 300,
      );
      if (trade) return { found: true, signature: trade.signature };
    } catch {
      // ignore — retry
    }

    try {
      const orders = await fetchWithTimeout(() =>
        fetchUserMarketOrders(marketId, userPubkey),
      );
      const order = orders.find(
        (o) =>
          o.placed_at >= orderStartTime - 60 &&
          o.placed_at <= orderStartTime + 300,
      );
      if (order) return { found: true };
    } catch {
      // ignore — retry
    }

    if (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1_500));
    }
  }
  return { found: false };
}

async function verifyOnChain(
  signature: string,
): Promise<{ landed: boolean; failed?: boolean }> {
  try {
    const res = await Promise.race([
      rpc.getSignatureStatuses([signature as never]).send(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("rpc timeout")), 8_000),
      ),
    ]);
    const status = res.value[0];
    if (status) {
      return { landed: true, failed: !!status.err };
    }
  } catch {
    // RPC unreachable or timed out
  }
  return { landed: false };
}

export async function classifyTxError(
  err: unknown,
  context?: {
    marketId: number;
    userPubkey: string;
    orderStartTime: number;
  },
): Promise<TxOutcome> {
  try {
    console.debug("[verify-tx] classifying error:", JSON.stringify(err, null, 2));
  } catch {
    console.debug("[verify-tx] classifying error (non-serializable):", err);
  }

  if (isUserRejection(err)) return { kind: "cancelled" };

  // Our Anchor program's custom error (codes 6000–6999)
  const programCode = extractProgramErrorCode(err);
  if (programCode !== undefined) {
    return {
      kind: "failed",
      reason:
        PROGRAM_ERROR_MESSAGES[programCode] ??
        `Transaction rejected by the contract (code ${programCode})`,
    };
  }

  // Solana Kit SDK wrapper errors — show friendly message, then dig for real cause
  const sdkCode = extractSolanaKitCode(err);
  if (sdkCode !== undefined) {
    // If there's a nested program error inside the wrapper, surface that first
    const nested = walkError<number>(
      (err as Record<string, unknown>).cause ?? (err as Record<string, unknown>).context,
      (o) => {
        if (typeof o.code !== "number") return undefined;
        if (o.code >= 6000 && o.code <= 6999) return o.code;
        return undefined;
      },
    );
    if (nested !== undefined) {
      return {
        kind: "failed",
        reason: PROGRAM_ERROR_MESSAGES[nested] ?? `Transaction rejected by the contract (code ${nested})`,
      };
    }

    // No nested program error — use the friendly SDK message
    return {
      kind: "failed",
      reason: SOLANA_SDK_ERRORS[sdkCode] ?? "Transaction failed to send. Please try again.",
    };
  }

  const simLogs = extractSimLogs(err);
  if (simLogs?.length) {
    const lastLog = simLogs[simLogs.length - 1];
    if (
      lastLog.toLowerCase().includes("failed") ||
      lastLog.toLowerCase().includes("error")
    ) {
      return { kind: "failed", reason: lastLog };
    }
  }

  if (isConfirmationTimeout(err)) {
    const sig = extractSignature(err);
    if (sig) {
      const { landed, failed } = await verifyOnChain(sig);
      if (landed && !failed) return { kind: "success", signature: sig };
      if (landed && failed) return { kind: "failed", reason: "Transaction reverted on-chain" };
    }

    if (context?.userPubkey) {
      const { found, signature } = await verifyViaBackend(
        context.marketId,
        context.userPubkey,
        context.orderStartTime,
      );
      if (found) return { kind: "success", signature };
    }

    return {
      kind: "pending",
      hint: "Transaction submitted but confirmation timed out. Check your wallet or Solana explorer.",
    };
  }

  if (context?.userPubkey) {
    const { found, signature } = await verifyViaBackend(
      context.marketId,
      context.userPubkey,
      context.orderStartTime,
      5_000,
    );
    if (found) return { kind: "success", signature };
  }

  const rawMsg = err instanceof Error ? err.message : "Unknown error";
  return { kind: "failed", reason: cleanErrorMessage(rawMsg) };
}
