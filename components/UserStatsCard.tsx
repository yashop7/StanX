'use client';

import { useUserStats } from '@/hooks/use-user-stats';
import { useWalletSession } from '@solana/react-hooks';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface UserStatsCardProps {
  marketId: number;
}

export function UserStatsCard({ marketId }: UserStatsCardProps) {
  const session = useWalletSession();
  const { stats, isLoading } = useUserStats(marketId);

  if (!session) return null;

  const totalYes = stats ? stats.claimableYes + stats.lockedYes : 0;
  const totalNo = stats ? stats.claimableNo + stats.lockedNo : 0;
  const totalTokens = totalYes + totalNo;
  const yesPct = totalTokens > 0 ? (totalYes / totalTokens) * 100 : 50;

  return (
    <div className="panel-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Your Position
        </span>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
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
        <div className="p-5 space-y-4">
          {/* YES / NO side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div className={cn(
              "rounded-xl p-3.5 border",
              totalYes > 0 ? "bg-success/5 border-success/20" : "bg-muted/30 border-border"
            )}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className={cn("h-3.5 w-3.5", totalYes > 0 ? "text-success" : "text-muted-foreground")} />
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", totalYes > 0 ? "text-success" : "text-muted-foreground")}>
                  YES
                </span>
              </div>
              <p className={cn("text-xl font-bold font-mono tracking-tight", totalYes > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                {totalYes > 0 ? totalYes.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
              </p>
              {totalYes > 0 && (
                <div className="mt-2.5 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Claimable</span>
                    <span className="font-mono text-success">{stats.claimableYes.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Locked</span>
                    <span className="font-mono text-muted-foreground">{stats.lockedYes.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className={cn(
              "rounded-xl p-3.5 border",
              totalNo > 0 ? "bg-danger/5 border-danger/20" : "bg-muted/30 border-border"
            )}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className={cn("h-3.5 w-3.5", totalNo > 0 ? "text-danger" : "text-muted-foreground")} />
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", totalNo > 0 ? "text-danger" : "text-muted-foreground")}>
                  NO
                </span>
              </div>
              <p className={cn("text-xl font-bold font-mono tracking-tight", totalNo > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                {totalNo > 0 ? totalNo.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
              </p>
              {totalNo > 0 && (
                <div className="mt-2.5 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Claimable</span>
                    <span className="font-mono text-danger">{stats.claimableNo.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Locked</span>
                    <span className="font-mono text-muted-foreground">{stats.lockedNo.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* YES / NO split bar */}
          {totalTokens > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>YES {yesPct.toFixed(0)}%</span>
                <span>NO {(100 - yesPct).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
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

          {/* USDC Collateral */}
          {(stats.claimableCollateral > 0 || stats.lockedCollateral > 0) && (
            <div className="rounded-xl border border-border bg-muted/20 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
                USDC Collateral
              </p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-base font-bold font-mono">
                    ${(stats.claimableCollateral + stats.lockedCollateral).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Total locked</p>
                </div>
                {stats.claimableCollateral > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-semibold font-mono text-success">
                      ${stats.claimableCollateral.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Claimable</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
