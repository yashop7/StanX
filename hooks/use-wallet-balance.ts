"use client";

import { useWalletSession, useSolanaClient } from "@solana/react-hooks";
import { useState, useEffect } from "react";
import { address } from "@solana/kit";

/**
 * Custom hook to fetch the SOL balance of the connected wallet
 * @returns balance in SOL (as a number) or null if not connected
 */
export function useWalletBalance() {
  const wallet = useWalletSession();
  const client = useSolanaClient();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        setLoading(true);
        const walletAddr = address(wallet.account.address);
        const accountInfo = await client.actions.fetchBalance(walletAddr);
        const solBalance = Number(accountInfo) / 1_000_000_000;
        setBalance(solBalance);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setBalance(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();

    const interval = setInterval(fetchBalance, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [wallet, client]);

  return { balance, loading };
}
