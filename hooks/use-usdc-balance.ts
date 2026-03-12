"use client";

import { useWalletSession } from "@solana/react-hooks";
import { useState, useEffect } from "react";
import { address } from "@solana/kit";
import { USDC_MINT, SOLANA_NETWORK } from "@/lib/constants";
import { rpc } from "@/lib/blockchain/client";

// fetching the USDC Balance
export function useUsdcBalance() {
  return useTokenBalance();
}

/**
 * Fetches the SPL token balance for the connected wallet.
 * @param mintAddress - Token mint address. Defaults to devnet USDC when omitted.
 */
export function useTokenBalance(mintAddress?: string) {
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
        const resolvedMint = mintAddress
          ? address(mintAddress)
          : address(USDC_MINT[SOLANA_NETWORK as keyof typeof USDC_MINT] ?? USDC_MINT.devnet);
        const usdcMint = resolvedMint;

        //   querying all token accounts owned by the wallet filtered by the mint
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
  }, [wallet, mintAddress]);

  return { usdcBalance, loading };
}
