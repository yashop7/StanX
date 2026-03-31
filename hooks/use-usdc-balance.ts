"use client";

import { useWalletSession } from "@solana/react-hooks";
import { useState, useEffect, useRef } from "react";
import { address } from "@solana/kit";
import { USDC_MINT, SOLANA_NETWORK } from "@/lib/constants";
import { rpc } from "@/lib/blockchain/client";

// ─── Module-level singleton cache ─────────────────────────────────────────────
// Shared across ALL hook instances so N components on the same page never fire
// duplicate RPC calls. One fetch serves every subscriber.

const POLL_MS    = 60_000;   // normal poll interval
const BACKOFF_MS = 120_000;  // wait 2 min after a 429 before retrying

interface CacheEntry { balance: number | null; ts: number }
const cache     = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<(b: number | null) => void>>();
const inflight  = new Map<string, Promise<number | null>>();
const timers    = new Map<string, ReturnType<typeof setTimeout>>();

function notify(key: string, balance: number | null) {
  listeners.get(key)?.forEach((cb) => cb(balance));
}

function subscribe(key: string, cb: (b: number | null) => void): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(cb);
  return () => listeners.get(key)?.delete(cb);
}

async function doFetch(walletAddr: string, mintAddr: string): Promise<number | null> {
  const key = `${walletAddr}:${mintAddr}`;

  // Already in-flight — share the same promise
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<number | null> => {
    const prev = cache.get(key)?.balance ?? null;
    try {
      const tokenAccounts = await rpc
        .getTokenAccountsByOwner(
          address(walletAddr),
          { mint: address(mintAddr) },
          { encoding: "jsonParsed" },
        )
        .send();

      let balance: number | null = 0;
      if (tokenAccounts.value.length > 0) {
        const data = tokenAccounts.value[0].account.data;
        if (
          typeof data === "object" &&
          "parsed" in data &&
          data.parsed?.info?.tokenAmount?.uiAmountString !== undefined
        ) {
          balance = parseFloat(data.parsed.info.tokenAmount.uiAmountString) || 0;
        }
      }

      cache.set(key, { balance, ts: Date.now() });
      notify(key, balance);
      schedulePoll(walletAddr, mintAddr, POLL_MS);
      return balance;
    } catch (err: unknown) {
      const is429 =
        err instanceof Error &&
        (err.message.includes("429") || err.message.toLowerCase().includes("rate"));

      if (!is429) {
        console.error("Failed to fetch USDC balance:", err);
      }
      // On 429, back off; otherwise retry on normal interval
      schedulePoll(walletAddr, mintAddr, is429 ? BACKOFF_MS : POLL_MS);
      return prev;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

function schedulePoll(walletAddr: string, mintAddr: string, delay: number) {
  const key = `${walletAddr}:${mintAddr}`;
  // Clear any existing scheduled poll for this key
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  // Only schedule if there are still active subscribers
  if ((listeners.get(key)?.size ?? 0) > 0) {
    timers.set(key, setTimeout(() => doFetch(walletAddr, mintAddr), delay));
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useUsdcBalance() {
  return useTokenBalance();
}

export function useTokenBalance(mintAddress?: string) {
  const wallet = useWalletSession();
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!wallet) {
      setUsdcBalance(null);
      return;
    }

    const walletAddr = wallet.account.address as string;
    const mintAddr =
      mintAddress ??
      (USDC_MINT[SOLANA_NETWORK as keyof typeof USDC_MINT] ?? USDC_MINT.devnet);
    const key = `${walletAddr}:${mintAddr}`;

    // Seed from cache immediately so there's no loading flash on re-mount
    const cached = cache.get(key);
    if (cached) setUsdcBalance(cached.balance);

    // Subscribe to updates from the shared fetcher
    unsubRef.current = subscribe(key, setUsdcBalance);

    // Kick off initial fetch (no-op if another instance already has one in-flight)
    setLoading(true);
    doFetch(walletAddr, mintAddr).then((b) => {
      setUsdcBalance(b);
      setLoading(false);
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
      // If no subscribers left, cancel the pending poll
      if ((listeners.get(key)?.size ?? 0) === 0) {
        const t = timers.get(key);
        if (t) { clearTimeout(t); timers.delete(key); }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, mintAddress]);

  return { usdcBalance, loading };
}