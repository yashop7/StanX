"use client";

import { useWalletSession } from "@solana/react-hooks";
import { useState, useEffect } from "react";
import { address } from "@solana/kit";
import { USDC_MINT, SOLANA_NETWORK } from "@/lib/constants";
import { rpc } from "@/lib/blockchain/client";

// fetching the USDC Balance
export function useUsdcBalance() {
  const wallet = useWalletSession();
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setUsdcBalance(null);
      return;
    }

    const fetchUsdcBalance = async () => {
      try {
        setLoading(true);

        const walletAddr = address(wallet.account.address);
        const usdcMint = address(
          USDC_MINT[SOLANA_NETWORK as keyof typeof USDC_MINT] ?? USDC_MINT.devnet
        );

        //   querying all token accounts owned by the wallet filtered by the USDC mint
        const tokenAccounts = await rpc
          .getTokenAccountsByOwner(
            walletAddr,
            { mint: usdcMint },
            { encoding: "jsonParsed" }
          )
          .send();

        if (tokenAccounts.value.length === 0) {
          setUsdcBalance(0);
          return;
        }

        const accountData = tokenAccounts.value[0].account.data;
        if (
          typeof accountData === "object" &&
          "parsed" in accountData &&
          accountData.parsed?.info?.tokenAmount?.uiAmount !== undefined
        ) {
          setUsdcBalance(accountData.parsed.info.tokenAmount.uiAmount ?? 0);
        } else {
          setUsdcBalance(0);
        }
      } catch (error) {
        console.error("Failed to fetch USDC balance:", error);
        setUsdcBalance(0);
      } finally {
        setLoading(false);
      }
    };

    fetchUsdcBalance();

    const interval = setInterval(fetchUsdcBalance, 30000);

    return () => clearInterval(interval);
  }, [wallet]);

  return { usdcBalance, loading };
}
