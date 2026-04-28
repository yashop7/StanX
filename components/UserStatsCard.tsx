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
import { SOLANA_NETWORK } from '@/lib/constants';
import { classifyTxError, isUserRejection } from '@/lib/blockchain/verify-tx';

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
  const { usdcBalance: yesWallet, refresh: refreshYes } = useTokenBalance(outcomeYesMint);
  const { usdcBalance: noWallet, refresh: refreshNo } = useTokenBalance(outcomeNoMint);

  const yesHeld = yesWallet ?? 0;
  const noHeld  = noWallet  ?? 0;
  const hasAnyPosition = yesHeld > 0 || noHeld > 0 || !!stats;

  const canClaim = stats && !stats.rewardClaimed &&
    (stats.claimableCollateral > 0 || stats.claimableYes > 0 || stats.claimableNo > 0);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(p => p + 1);
    void refreshYes();
    void refreshNo();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const explorerUrl = (sig: string) =>
    SOLANA_NETWORK === 'mainnet'
      ? `https://explorer.solana.com/tx/${sig}`
      : `https://explorer.solana.com/tx/${sig}?cluster=${SOLANA_NETWORK}`;

  const explorerAction = (sig: string) => ({
    label: 'View on Explorer',
    onClick: () => window.open(explorerUrl(sig), '_blank'),
  });

  const handleClaimFunds = async () => {
    if (!session) { toast.error('Connect your wallet first.'); return; }
    const { signer } = createWalletTransactionSigner(session);
    const claimableUsdc =
      (stats?.claimableYes ?? 0) + (stats?.claimableNo ?? 0) + (stats?.claimableCollateral ?? 0);
    try {
      const ix = await buildClaimFundsInstruction({ userSigner: signer, marketId });
      const sig = await send({ instructions: [ix], authority: signer });
      const sigStr = String(sig);
      toast.success('Funds claimed!', {
        description: claimableUsdc > 0
          ? `$${claimableUsdc.toFixed(2)} USDC transferred to your wallet.`
          : 'Your claimable tokens have been transferred to your wallet.',
        action: explorerAction(sigStr),
      });
      setRefreshTrigger(p => p + 1);
      void refreshYes();
      void refreshNo();
    } catch (err) {
      if (isUserRejection(err)) {
        toast.info('Transaction cancelled', { description: 'You rejected the transaction in your wallet.' });
        return;
      }

      const verifyToastId = toast.loading('Verifying transaction on-chain…');
      try {
        const outcome = await classifyTxError(err);
        if (outcome.kind === 'success') {
          toast.success('Funds claimed!', {
            description: claimableUsdc > 0
              ? `$${claimableUsdc.toFixed(2)} USDC transferred to your wallet.`
              : 'Your claimable tokens have been transferred to your wallet.',
            ...(outcome.signature ? { action: explorerAction(outcome.signature) } : {}),
          });
          setRefreshTrigger(p => p + 1);
        } else if (outcome.kind === 'pending') {
          toast.warning('Claim transaction submitted', {
            description: outcome.hint,
            ...(outcome.signature ? { action: explorerAction(outcome.signature) } : {}),
          });
        } else if (outcome.kind === 'failed') {
          toast.error('Claim failed', { description: outcome.reason });
        } else {
          toast.info('Transaction cancelled');
        }
      } finally {
        toast.dismiss(verifyToastId);
      }
    }
  };

  if (!session) return null;

  return (
    <div className="panel-card min-w-0 overflow-hidden">
      {/* Header */}
      <div className="panel-header flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
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
            <div className="overflow-hidden rounded-lg border border-border">
                {/* Column headers */}
                <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted/20 px-2.5 py-2 sm:px-3">
                  <span className="text-[10px] font-medium text-muted-foreground/60"></span>
                  <span className="text-right text-[10px] font-semibold text-success">Claimable</span>
                  <span className="text-right text-[10px] font-semibold text-muted-foreground/60">Locked</span>
                </div>

                {/* YES row */}
                <div className="grid grid-cols-3 items-center gap-2 border-b border-border/50 px-2.5 py-2.5 sm:px-3">
                  <span className="text-xs font-semibold text-success">YES</span>
                  <span className={cn('break-all text-right text-[11px] font-mono sm:text-xs', stats.claimableYes > 0 ? 'text-success' : 'text-muted-foreground/40')}>
                    {fmt(stats.claimableYes)}
                  </span>
                  <span className={cn('break-all text-right text-[11px] font-mono sm:text-xs', stats.lockedYes > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                    {fmt(stats.lockedYes)}
                  </span>
                </div>

                {/* NO row */}
                <div className="grid grid-cols-3 items-center gap-2 border-b border-border/50 px-2.5 py-2.5 sm:px-3">
                  <span className="text-xs font-semibold text-danger">NO</span>
                  <span className={cn('break-all text-right text-[11px] font-mono sm:text-xs', stats.claimableNo > 0 ? 'text-success' : 'text-muted-foreground/40')}>
                    {fmt(stats.claimableNo)}
                  </span>
                  <span className={cn('break-all text-right text-[11px] font-mono sm:text-xs', stats.lockedNo > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                    {fmt(stats.lockedNo)}
                  </span>
                </div>

                {/* USDC row */}
                <div className="grid grid-cols-3 items-center gap-2 px-2.5 py-2.5 sm:px-3">
                  <span className="text-xs font-semibold text-muted-foreground">USDC</span>
                  <span className={cn('break-all text-right text-[11px] font-mono sm:text-xs', stats.claimableCollateral > 0 ? 'text-success' : 'text-muted-foreground/40')}>
                    {fmtUSDC(stats.claimableCollateral)}
                  </span>
                  <span className={cn('break-all text-right text-[11px] font-mono sm:text-xs', stats.lockedCollateral > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
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
                ? "border-success/20 bg-success/5"
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
              className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-success text-white hover:bg-success/90 shadow-sm shadow-success/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
