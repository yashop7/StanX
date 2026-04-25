"use client";

import { useState } from "react";
import { X, Droplets } from "lucide-react";
import { useWalletSession } from "@solana/react-hooks";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { USDC_FAUCET_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SESSION_KEY = "faucet-banner-dismissed";

export const FaucetBanner = () => {
  const wallet = useWalletSession();
  const { usdcBalance, loading } = useUsdcBalance();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
  };

  const show = !dismissed && !!wallet && !loading && usdcBalance === 0;

  if (!show) return null;

  return (
    <div
      className={cn(
        "w-full border-b border-info/20 bg-info/5",
        "flex flex-wrap items-center gap-2 px-4 py-2 text-xs text-info"
      )}
    >
      <Droplets className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        Your wallet has no test USDC.{" "}
        <a
          href={USDC_FAUCET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:text-info/80 transition-colors"
        >
          Get free devnet USDC →
        </a>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-info/60 transition-colors hover:text-info"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
