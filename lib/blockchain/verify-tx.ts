import { rpc } from "./client";
import { fetchMarketTrades, fetchUserMarketOrders } from "@/lib/api/backend";

export type TxOutcome =
  | { kind: "success"; signature?: string }
  | { kind: "failed"; reason: string }
  | { kind: "cancelled" }
  | { kind: "pending"; hint: string; signature?: string };

export const PROGRAM_ERROR_MESSAGES: Record<number, string> = {
  0x1771: "Invalid settlement deadline",
  0x1772: "Market already settled",
  0x1773: "Market has expired",
  0x177a: "Market is not settled yet",
  0x177b: "Winning outcome is not set yet",
  0x1780: "Not authorized — wallet must be the market creator",
  0x178b: "Settlement deadline has not been reached yet",
};

// Solana Kit / transaction-wrapper errors.
// Some are definite pre-execution failures, while others mean the client is
// unsure whether the transaction landed and must verify before showing failure.
const DEFINITE_SDK_FAILURES: Record<number, string> = {
  7050003: "A required account was not found while preparing the transaction.",
  7050002: "Transaction could not be simulated.",
};

const UNCERTAIN_SDK_ERRORS: Record<number, string> = {
  7618003: "Transaction status is uncertain. We couldn't confirm it yet.",
  6291456: "Transaction was submitted but confirmation timed out.",
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

function hasBackendContext(
  context:
    | {
        marketId: number;
        userPubkey: string;
        orderStartTime: number;
      }
    | undefined,
): context is {
  marketId: number;
  userPubkey: string;
  orderStartTime: number;
} {
  return !!context?.userPubkey;
}

async function verifyBySignature(
  signature: string,
  maxMs = 20_000,
): Promise<TxOutcome | undefined> {
  const confirmation = await pollForConfirmation(signature, maxMs);
  if (confirmation.result === "confirmed") {
    return { kind: "success", signature };
  }
  if (confirmation.result === "failed") {
    return { kind: "failed", reason: "Transaction failed on-chain" };
  }
  return undefined;
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

  const sdkCode = extractSolanaKitCode(err);
  const signature = extractSignature(err);
  const isUncertainSdkError = sdkCode !== undefined && sdkCode in UNCERTAIN_SDK_ERRORS;
  const shouldVerifySignatureFirst =
    !!signature && (isConfirmationTimeout(err) || isUncertainSdkError || sdkCode === undefined);

  if (shouldVerifySignatureFirst && signature) {
    const signatureOutcome = await verifyBySignature(signature, 20_000);
    if (signatureOutcome) return signatureOutcome;
  }

  if (hasBackendContext(context)) {
    const shouldProbeBackend =
      isConfirmationTimeout(err) || isUncertainSdkError || sdkCode === 7618003 || sdkCode === undefined;
    if (shouldProbeBackend) {
      const { found, signature: backendSignature } = await verifyViaBackend(
        context.marketId,
        context.userPubkey,
        context.orderStartTime,
      );
      if (found) return { kind: "success", signature: backendSignature ?? signature };
    }
  }

  if (sdkCode !== undefined) {
    if (sdkCode in DEFINITE_SDK_FAILURES) {
      return {
        kind: "failed",
        reason:
          DEFINITE_SDK_FAILURES[sdkCode] ??
          "Transaction failed before it could be submitted.",
      };
    }
    if (sdkCode in UNCERTAIN_SDK_ERRORS) {
      return {
        kind: "pending",
        hint: `${UNCERTAIN_SDK_ERRORS[sdkCode]} Check your wallet or Solana explorer.`,
        signature,
      };
    }
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
    return {
      kind: "pending",
      hint: "Transaction submitted but confirmation timed out. Check your wallet or Solana explorer.",
      signature,
    };
  }

  if (hasBackendContext(context)) {
    const { found, signature } = await verifyViaBackend(
      context.marketId,
      context.userPubkey,
      context.orderStartTime,
      5_000,
    );
    if (found) return { kind: "success", signature };
  }

  if (signature) {
    return {
      kind: "pending",
      hint: "Transaction was submitted, but its final status is still uncertain. Check your wallet or Solana explorer.",
      signature,
    };
  }

  const rawMsg = err instanceof Error ? err.message : "Unknown error";
  return { kind: "failed", reason: cleanErrorMessage(rawMsg) };
}

/**
 * Poll `getSignatureStatuses` until the transaction is confirmed, failed, or
 * the timeout is reached. Returns a discriminated union so callers can handle
 * each case without ambiguity.
 *
 * Use this instead of waiting for useSendTransaction / sendAndConfirmTransaction
 * to time out — those throw even when the tx actually landed.
 *
 * @param sig    - base58 transaction signature (grab with getSignatureFromTransaction)
 * @param maxMs  - maximum wait time in milliseconds (default 75 000 ms / 75 s)
 */
export async function pollForConfirmation(
  sig: string,
  maxMs = 75_000,
): Promise<
  | { result: "confirmed"; slot: number }
  | { result: "failed"; err: unknown }
  | { result: "timeout" }
> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_000));
    try {
      const res = await Promise.race([
        rpc.getSignatureStatuses([sig as never]).send(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("rpc status timeout")), 6_000),
        ),
      ]);
      const status = res.value[0];
      if (!status) continue; // not yet seen by this RPC node
      if (status.err) return { result: "failed", err: status.err };
      if (
        status.confirmationStatus === "confirmed" ||
        status.confirmationStatus === "finalized"
      ) {
        return { result: "confirmed", slot: Number(status.slot) };
      }
      // status.confirmationStatus === "processed" — keep polling
    } catch {
      // RPC error / timeout — just retry
    }
  }
  return { result: "timeout" };
}
