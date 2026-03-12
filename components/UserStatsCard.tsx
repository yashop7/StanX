'use client';

import { useUserStats } from '@/hooks/use-user-stats';
import { useWalletSession } from '@solana/react-hooks';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Loader2, Lock, Coins, CheckCircle2 } from 'lucide-react';

interface UserStatsCardProps {
  marketId: number;
}

function StatRow({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  accent: 'emerald' | 'red' | 'violet';
}) {
  const colors = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    violet: 'text-violet-400',
  };
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-mono font-medium', value > 0 ? colors[accent] : 'text-muted-foreground/50')}>
        {value > 0 ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}{value > 0 ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

export function UserStatsCard({ marketId }: UserStatsCardProps) {
  const session = useWalletSession();
  const { stats, isLoading } = useUserStats(marketId);

  // Not connected
  if (!session) return null;

  return (
    <div className="panel-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Your Position
        </h4>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {!isLoading && stats?.rewardClaimed && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            Claimed
          </span>
        )}
      </div>

      {/* No account yet */}
      {!isLoading && !stats && (
        <p className="text-xs text-muted-foreground/60 text-center py-2">
          No position in this market yet.
        </p>
      )}

      {/* Stats */}
      {stats && (
        <div className="space-y-3">
          {/* YES tokens */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider">
              <Coins className="h-3 w-3" />
              YES Tokens
            </div>
            <div className="pl-2 space-y-1.5">
              <StatRow label="Claimable" value={stats.claimableYes} unit="YES" accent="emerald" />
              <StatRow label="Locked"    value={stats.lockedYes}    unit="YES" accent="emerald" />
            </div>
          </div>

          <Separator className="bg-border/20 dark:bg-border/10" />

          {/* NO tokens */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-red-400/80 uppercase tracking-wider">
              <Coins className="h-3 w-3" />
              NO Tokens
            </div>
            <div className="pl-2 space-y-1.5">
              <StatRow label="Claimable" value={stats.claimableNo} unit="NO" accent="red" />
              <StatRow label="Locked"    value={stats.lockedNo}    unit="NO" accent="red" />
            </div>
          </div>

          <Separator className="bg-border/20 dark:bg-border/10" />

          {/* Collateral (USDC) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-violet-400/80 uppercase tracking-wider">
              <Lock className="h-3 w-3" />
              Collateral (USDC)
            </div>
            <div className="pl-2 space-y-1.5">
              <StatRow label="Claimable" value={stats.claimableCollateral} unit="USDC" accent="violet" />
              <StatRow label="Locked"    value={stats.lockedCollateral}    unit="USDC" accent="violet" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
