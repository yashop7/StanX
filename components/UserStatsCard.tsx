'use client';

import { useUserStats } from '@/hooks/use-user-stats';
import { useTokenBalance } from '@/hooks/use-usdc-balance';
import { useWalletSession, useSendTransaction } from '@solana/react-hooks';
import { createWalletTransactionSigner } from '@solana/client';
import { cn } from '@/lib/utils';
import { RefreshCw, Loader2, ArrowDownToLine, CheckCircle2, Lock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { buildClaimFundsInstruction } from '@/lib/blockchain/market';

interface UserStatsCardProps {
  marketId: number;
  outcomeYesMint?: string;
  outcomeNoMint?: string;
  isSettled?: boolean;
  winningOutcome?: "YES" | "NO" | "NEITHER" | null;
}

/**
 * Show up to 6 decimal places, stripping trailing zeros.
 * e.g. 13.02 → "13.02"  |  13.000001 → "13.000001"  |  0.200000 → "0.2"
 */
function fmt(value: number): string {
  if (value === 0) return '0';
  return parseFloat(value.toFixed(6)).toString();
}

function fmtUSDC(value: number): string {
  if (value === 0) return '$0';
  return '$' + parseFloat(value.toFixed(6)).toString();
}

export function UserStatsCard({ marketId, outcomeYesMint, outcomeNoMint, isSettled, winningOutcome }: UserStatsCardProps) {
  const session = useWalletSession();
  const { send, isSending } = useSendTransaction();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { stats, isLoading } = useUserStats(marketId, refreshTrigger);
  const { usdcBalance: yesWallet } = useTokenBalance(outcomeYesMint);
  const { usdcBalance: noWallet } = useTokenBalance(outcomeNoMint);

  const yesHeld = yesWallet ?? 0;
  const noHeld  = noWallet  ?? 0;
  const hasAnyPosition = yesHeld > 0 || noHeld > 0 || !!stats;

  const canClaim = stats && !stats.rewardClaimed &&
    (stats.claimableCollateral > 0 || stats.claimableYes > 0 || stats.claimableNo > 0);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(p => p + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleClaimFunds = async () => {
    if (!session) { toast.error('Connect your wallet first.'); return; }
    const { signer } = createWalletTransactionSigner(session);
    try {
      const ix = await buildClaimFundsInstruction({ userSigner: signer, marketId });
      const sig = await send({ instructions: [ix], authority: signer });
      toast.success('Claimed!', {
        description: `Funds transferred to your wallet — tx: ${String(sig).slice(0, 8)}…`,
      });
      setRefreshTrigger(p => p + 1);
    } catch (err) {
      toast.error('Claim failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  if (!session) return null;

  const yesPct = yesHeld + noHeld > 0 ? (yesHeld / (yesHeld + noHeld)) * 100 : 50;

  return (
    <div className="panel-card overflow-hidden">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Your Position
          </h3>
          {stats?.rewardClaimed && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Claimed
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', (isLoading || isRefreshing) && 'animate-spin')} />
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 rounded-lg bg-muted/30 animate-pulse" />
            <div className="h-16 rounded-lg bg-muted/30 animate-pulse" />
          </div>
          <div className="h-24 rounded-lg bg-muted/20 animate-pulse" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && !hasAnyPosition && (
        <div className="py-7 px-5 text-center">
          <p className="text-xs text-muted-foreground/50">No position in this market yet.</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && hasAnyPosition && (
        <div className="p-4 space-y-3">

          {/* ── Wallet balances ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            <div className={cn('stat-box transition-all', yesHeld > 0 && 'bg-success/8 border-success/25')}>
              <div className={cn('text-[10px] font-bold uppercase tracking-wider mb-1', yesHeld > 0 ? 'text-success' : 'text-muted-foreground/40')}>YES</div>
              <div className={cn('text-sm font-bold font-mono leading-none', yesHeld > 0 ? 'text-foreground' : 'text-muted-foreground/25')}>
                {yesHeld > 0 ? fmt(yesHeld) : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground/40 mt-1">in wallet</div>
            </div>
            <div className={cn('stat-box transition-all', noHeld > 0 && 'bg-danger/8 border-danger/25')}>
              <div className={cn('text-[10px] font-bold uppercase tracking-wider mb-1', noHeld > 0 ? 'text-danger' : 'text-muted-foreground/40')}>NO</div>
              <div className={cn('text-sm font-bold font-mono leading-none', noHeld > 0 ? 'text-foreground' : 'text-muted-foreground/25')}>
                {noHeld > 0 ? fmt(noHeld) : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground/40 mt-1">in wallet</div>
            </div>
          </div>

          {/* ── Protocol stats breakdown ─────────────────────── */}
          {stats && (
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-3 px-3 py-2 bg-muted/20 border-b border-border">
                <span className="text-[10px] font-medium text-muted-foreground/60"></span>
                <span className="text-[10px] font-semibold text-success text-right">Claimable</span>
                <span className="text-[10px] font-semibold text-muted-foreground/60 text-right">Locked</span>
              </div>

              {/* YES row */}
              <div className="grid grid-cols-3 items-center px-3 py-2.5 border-b border-border/50">
                <span className="text-xs font-semibold text-success">YES</span>
                <span className={cn('text-xs font-mono text-right', stats.claimableYes > 0 ? 'text-success' : 'text-muted-foreground/40')}>
                  {fmt(stats.claimableYes)}
                </span>
                <span className={cn('text-xs font-mono text-right', stats.lockedYes > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                  {fmt(stats.lockedYes)}
                </span>
              </div>

              {/* NO row */}
              <div className="grid grid-cols-3 items-center px-3 py-2.5 border-b border-border/50">
                <span className="text-xs font-semibold text-danger">NO</span>
                <span className={cn('text-xs font-mono text-right', stats.claimableNo > 0 ? 'text-success' : 'text-muted-foreground/40')}>
                  {fmt(stats.claimableNo)}
                </span>
                <span className={cn('text-xs font-mono text-right', stats.lockedNo > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                  {fmt(stats.lockedNo)}
                </span>
              </div>

              {/* USDC row */}
              <div className="grid grid-cols-3 items-center px-3 py-2.5">
                <span className="text-xs font-semibold text-muted-foreground">USDC</span>
                <span className={cn('text-xs font-mono text-right', stats.claimableCollateral > 0 ? 'text-success' : 'text-muted-foreground/40')}>
                  {fmtUSDC(stats.claimableCollateral)}
                </span>
                <span className={cn('text-xs font-mono text-right', stats.lockedCollateral > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                  {fmtUSDC(stats.lockedCollateral)}
                </span>
              </div>
            </div>
          )}
          
          {/* ── Settlement payout summary ─────────────────── */}
          {isSettled && hasAnyPosition && (
            <div className={cn(
              "rounded-lg border p-3 space-y-2",
              stats?.rewardClaimed
                ? "border-emerald-500/20 bg-emerald-500/5"
                : canClaim
                  ? "border-amber-500/20 bg-amber-500/5"
                  : "border-border/30 bg-muted/10"
            )}>
              {stats?.rewardClaimed ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Rewards Claimed</p>
                    <p className="text-[10px] text-muted-foreground">Your winnings have been transferred to your wallet.</p>
                  </div>
                </div>
              ) : canClaim ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-amber-400">Rewards Available</p>
                  <p className="text-[10px] text-muted-foreground">
                    {winningOutcome === 'YES' && yesHeld > 0
                      ? `You hold ${fmt(yesHeld)} YES tokens → claim up to $${fmt(yesHeld)} USDC`
                      : winningOutcome === 'NO' && noHeld > 0
                        ? `You hold ${fmt(noHeld)} NO tokens → claim up to $${fmt(noHeld)} USDC`
                        : 'You have claimable funds from this market.'}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <p className="text-[10px] text-muted-foreground">
                    {winningOutcome && winningOutcome !== 'NEITHER'
                      ? `${winningOutcome === 'YES' ? 'NO' : 'YES'} tokens have no value after resolution.`
                      : 'No claimable rewards for this market.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Claim button ─────────────────────────────────── */}
          {canClaim && (
            <button
              onClick={handleClaimFunds}
              disabled={isSending}
              className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-success text-white hover:brightness-110 shadow-sm shadow-success/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ArrowDownToLine className="h-3.5 w-3.5" />}
              {isSending ? 'Claiming…' : 'Claim to Wallet'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
