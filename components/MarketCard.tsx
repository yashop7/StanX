import { useMemo } from 'react';
import Link from 'next/link';
import { Users, Clock, ArrowUpRight } from 'lucide-react';
import { LogoMark } from '@/components/LogoMark';
import type { DisplayMarket } from '@/lib/blockchain/markets';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface MarketCardProps {
  market: DisplayMarket;
  featured?: boolean;
  compact?: boolean;
}

export const MarketCard = ({ market, featured = false, compact = false }: MarketCardProps) => {
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = 100 - yesPercent;

  const formatVolume = (volume: number) => {
    if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
    if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K`;
    return `$${volume}`;
  };

  // Compact variant for lists / tickers
  if (compact) {
    return (
      <Link href={`/market/${market.marketId}`} className="block group">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border hover:border-border-strong transition-all duration-150">
          <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-muted">
            <img src={market.image} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug line-clamp-1 text-foreground">
              {market.question}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatVolume(market.volume)} · {formatDistanceToNow(market.endDate, { addSuffix: false })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold text-success tabular-nums">{yesPercent}¢</span>
            <span className="text-muted-foreground/40 text-xs">/</span>
            <span className="text-xs font-semibold text-danger tabular-nums">{noPercent}¢</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/market/${market.marketId}`} className="block group h-full">
      <div
        className={cn(
          "relative h-full rounded-xl border border-border bg-card overflow-hidden",
          "transition-all duration-200 hover:border-border-strong hover:shadow-[0_0_0_1px_var(--border-strong)]",
          featured && "lg:flex lg:flex-row"
        )}
      >
        {/* Image */}
        <div
          className={cn(
            "relative overflow-hidden bg-muted",
            featured ? "lg:w-[38%] h-40 lg:h-auto" : "h-36"
          )}
        >
          <img
            src={market.image}
            alt={market.question}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

          {/* Category badge */}
          <div className="absolute top-2.5 left-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white/90 border border-white/10">
              {market.category}
            </span>
          </div>

          {/* Arrow on hover */}
          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
            <div className="w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <ArrowUpRight className="h-3 w-3 text-white" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={cn("flex flex-col p-4", featured ? "lg:flex-1 lg:p-5 lg:justify-between" : "")}>
          {/* Question */}
          <h3
            className={cn(
              "font-medium leading-snug tracking-tight line-clamp-2 text-foreground mb-3",
              featured ? "text-base lg:text-lg mb-4" : "text-sm"
            )}
          >
            {market.question}
          </h3>

          {/* YES/NO */}
          <div className="flex items-center gap-2 mb-4">
            <button className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-md border border-success/20 bg-success/5 hover:bg-success/10 transition-colors group/yes">
              <span className="text-[11px] font-semibold text-success uppercase tracking-wide">Yes</span>
              <span className="text-sm font-bold text-success tabular-nums">{yesPercent}¢</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-md border border-danger/20 bg-danger/5 hover:bg-danger/10 transition-colors group/no">
              <span className="text-[11px] font-semibold text-danger uppercase tracking-wide">No</span>
              <span className="text-sm font-bold text-danger tabular-nums">{noPercent}¢</span>
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-3.5">
            <div className="h-0.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-success transition-all duration-500"
                style={{ width: `${yesPercent}%`, opacity: 0.7 }}
              />
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {market.participants.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(market.endDate, { addSuffix: false })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};
