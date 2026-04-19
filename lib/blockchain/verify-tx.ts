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

export function extractProgramErrorCode(err: unknown): number | undefined {
  return walkError<number>(err, (o) =>
    typeof o.code === "number" ? o.code : undefined,
  );
}

export function extractSimLogs(err: unknown): string[] | undefined {
  return walkError<string[]>(err, (o) =>
    Array.isArray(o.logs) ? (o.logs as string[]) : undefined,
  );
}

function extractSignature(err: unknown): string | undefined {
  // Check nested object fields
  const fromWalk = walkError<string>(err, (o) => {
    for (const key of ["signature", "txSignature", "transactionSignature"]) {
      if (typeof o[key] === "string" && (o[key] as string).length > 40)
        return o[key] as string;
    }
    return undefined;
  });
  if (fromWalk) return fromWalk;

  // Also scan error message string — some errors embed the sig in text
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

/** Fetch with an abort timeout so slow DB connections don't hang the poller. */
async function fetchWithTimeout<T>(fn: () => Promise<T>, ms = 4_000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("fetch timeout")), ms),
    ),
  ]);
}

/**
 * Poll the backend indexer until we find evidence of the order/trade, or time out.
 *
 * @param orderStartTime  unix-seconds captured BEFORE send() was called.
 *                        We search for records where placed_at / event_timestamp
 *                        is within [orderStartTime - 60, now].
 */
async function verifyViaBackend(
  marketId: number,
  userPubkey: string,
  orderStartTime: number,
  maxWaitMs = 12_000,
): Promise<{ found: boolean; signature?: string }> {
  const deadline = Date.now() + maxWaitMs;
  // Give the indexer one moment to process the block
  await new Promise((r) => setTimeout(r, 1_000));

  while (Date.now() < deadline) {
    try {
      const trades = await fetchWithTimeout(() => fetchMarketTrades(marketId, 30));
      const trade = trades.find(
        (t) =>
          t.taker === userPubkey &&
          // allow a 60-second window before orderStartTime to account for clock drift
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
    const res = await rpc.getSignatureStatuses([signature as never]).send();
    const status = res.value[0];
    if (status) {
      return { landed: true, failed: !!status.err };
    }
  } catch {
    // RPC unreachable
  }
  return { landed: false };
}

/**
 * Given a thrown error from send(), classify what actually happened.
 * Pass `context` (marketId, userPubkey, orderStartTime) to enable backend verification.
 */
export async function classifyTxError(
  err: unknown,
  context?: {
    marketId: number;
    userPubkey: string;
    /** unix seconds — MUST be captured before send() was called */
    orderStartTime: number;
  },
): Promise<TxOutcome> {
  // Log full error so we can see its structure during debugging
  console.debug("[verify-tx] classifying error:", JSON.stringify(err, null, 2));

  if (isUserRejection(err)) return { kind: "cancelled" };

  const programCode = extractProgramErrorCode(err);
  if (programCode !== undefined) {
    return {
      kind: "failed",
      reason:
        PROGRAM_ERROR_MESSAGES[programCode] ??
        `Program error 0x${programCode.toString(16)}`,
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
    // Try RPC first (fast if we have the sig)
    const sig = extractSignature(err);
    if (sig) {
      const { landed, failed } = await verifyOnChain(sig);
      if (landed && !failed) return { kind: "success", signature: sig };
      if (landed && failed) return { kind: "failed", reason: "Transaction reverted on-chain" };
    }

    // Fall back to backend indexer polling
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

  // Unknown error — could still be a timeout with a different message
  // If we have context, try the backend as a last resort
  if (context?.userPubkey) {
    const { found, signature } = await verifyViaBackend(
      context.marketId,
      context.userPubkey,
      context.orderStartTime,
      5_000, // shorter window for unknown errors
    );
    if (found) return { kind: "success", signature };
  }

  return {
    kind: "failed",
    reason: err instanceof Error ? err.message : "Unknown error",
  };
}
