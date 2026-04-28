'use client';

import { useEffect, useState } from 'react';
import { useWalletSession } from '@solana/react-hooks';
import {
  getProgramDerivedAddress,
  getBytesEncoder,
  getU32Encoder,
  getAddressEncoder,
  type Address,
} from '@solana/kit';
import { fetchMaybeUserStats, type UserStats } from '@/generated/accounts/userStats';
import { PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS } from '@/generated/programs';
import { rpc } from '@/lib/blockchain/client';

// "user_stats" as bytes
const USER_STATS_SEED = new Uint8Array([
  117, 115, 101, 114, 95, 115, 116, 97, 116, 115,
]);

const PRICE_SCALE = 1_000_000; // micro-USDC per USDC / token base units per token

export interface UserStatsData {
  claimableYes: number;   // tokens (human-readable)
  lockedYes: number;
  claimableNo: number;
  lockedNo: number;
  claimableCollateral: number; // USDC
  lockedCollateral: number;
  rewardClaimed: boolean;
}

export function useUserStats(marketId: number, refreshTrigger?: number) {
  const session = useWalletSession();
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!session || isNaN(marketId)) {
      setStats(null);
      return;
    }

    let cancelled = false;

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const walletAddress = session.account.address as Address;

        const [pda] = await getProgramDerivedAddress({
          programAddress: PREDICTION_MARKET_TURBIN3_PROGRAM_ADDRESS,
          seeds: [
            getBytesEncoder().encode(USER_STATS_SEED),
            getU32Encoder().encode(marketId),
            getAddressEncoder().encode(walletAddress),
          ],
        });

        const account = await fetchMaybeUserStats(rpc, pda);
        if (cancelled) return;

        if (account.exists) {
          const d = account.data;
          setStats({
            claimableYes:        Number(d.claimableYes) / PRICE_SCALE,
            lockedYes:           Number(d.lockedYes) / PRICE_SCALE,
            claimableNo:         Number(d.claimableNo) / PRICE_SCALE,
            lockedNo:            Number(d.lockedNo) / PRICE_SCALE,
            claimableCollateral: Number(d.claimableCollateral) / PRICE_SCALE,
            lockedCollateral:    Number(d.lockedCollateral) / PRICE_SCALE,
            rewardClaimed:       d.rewardClaimed,
          });
        } else {
          setStats(null);
        }
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session, marketId, refreshTrigger]);

  return { stats, isLoading };
}
