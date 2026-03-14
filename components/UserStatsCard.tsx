'use client';

import { useUserStats } from '@/hooks/use-user-stats';
import { useWalletSession } from '@solana/react-hooks';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, TrendingUp, TrendingDown, Wallet, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface UserStatsCardProps {
  marketId: number;
}

export function UserStatsCard({ marketId }: UserStatsCardProps) {
  const session = useWalletSession();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { stats, isLoading } = useUserStats(marketId, refreshTrigger);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (!session) return null;

  const totalYes = stats ? stats.claimableYes + stats.lockedYes : 0;
  const totalNo = stats ? stats.claimableNo + stats.lockedNo : 0;
  const totalTokens = totalYes + totalNo;
  const yesPct = totalTokens > 0 ? (totalYes / totalTokens) * 100 : 50;

  return (
    <div className="panel-card overflow-hidden">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Your Position
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 border border-border/20 hover:border-border/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn('h-3 w-3', (isLoading || isRefreshing) && 'animate-spin')} />
            Refresh
          </button>
          {!isLoading && stats?.rewardClaimed && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Claimed
            </span>
          )}
        </div>
      </div>

      {/* No position */}
      {!isLoading && !stats && (
        <div className="flex flex-col items-center justify-center py-8 px-5 text-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">No position in this market yet.</p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="p-4 space-y-4">
          {/* Position breakdown - simplified grid */}
          <div className="space-y-3">
            {/* YES Tokens */}
            <div className={cn(
              "rounded-lg p-3 border transition-all",
              totalYes > 0 ? "bg-success/8 border-success/20" : "bg-muted/30 border-border/50"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className={cn("h-3.5 w-3.5", totalYes > 0 ? "text-success" : "text-muted-foreground/50")} />
                  <span className={cn("text-[11px] font-semibold", totalYes > 0 ? "text-success" : "text-muted-foreground/50")}>
                    YES
                  </span>
                </div>
                <p className={cn("text-sm font-bold font-mono", totalYes > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                  {totalYes > 0 ? totalYes.toFixed(2) : '—'}
                </p>
              </div>
              {totalYes > 0 && (
                <div className="mt-2 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Claimable:</span>
                    <span className="font-mono text-success">{stats.claimableYes.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Locked:</span>
                    <span className="font-mono text-muted-foreground/70">{stats.lockedYes.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* NO Tokens */}
            <div className={cn(
              "rounded-lg p-3 border transition-all",
              totalNo > 0 ? "bg-danger/8 border-danger/20" : "bg-muted/30 border-border/50"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className={cn("h-3.5 w-3.5", totalNo > 0 ? "text-danger" : "text-muted-foreground/50")} />
                  <span className={cn("text-[11px] font-semibold", totalNo > 0 ? "text-danger" : "text-muted-foreground/50")}>
                    NO
                  </span>
                </div>
                <p className={cn("text-sm font-bold font-mono", totalNo > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                  {totalNo > 0 ? totalNo.toFixed(2) : '—'}
                </p>
              </div>
              {totalNo > 0 && (
                <div className="mt-2 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Claimable:</span>
                    <span className="font-mono text-danger">{stats.claimableNo.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Locked:</span>
                    <span className="font-mono text-muted-foreground/70">{stats.lockedNo.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* USDC Collateral */}
            {(stats.claimableCollateral > 0 || stats.lockedCollateral > 0) && (
              <div className="rounded-lg p-3 border bg-muted/30 border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      USDC
                    </span>
                  </div>
                  <p className="text-sm font-bold font-mono text-foreground">
                    ${(stats.claimableCollateral + stats.lockedCollateral).toFixed(2)}
                  </p>
                </div>
                <div className="mt-2 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Claimable:</span>
                    <span className="font-mono text-success">${stats.claimableCollateral.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Locked:</span>
                    <span className="font-mono text-muted-foreground/70">${stats.lockedCollateral.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* YES / NO split bar */}
          {totalTokens > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border/30">
              <div className="flex justify-between text-[10px] text-muted-foreground/70">
                <span>YES {yesPct.toFixed(0)}%</span>
                <span>NO {(100 - yesPct).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden flex">
                <div
                  className="h-full bg-success transition-all duration-500"
                  style={{ width: `${yesPct}%` }}
                />
                <div
                  className="h-full bg-danger transition-all duration-500"
                  style={{ width: `${100 - yesPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
