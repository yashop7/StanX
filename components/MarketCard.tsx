import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Clock, ArrowUpRight } from 'lucide-react';
import { Market } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface MarketCardProps {
  market: Market;
  featured?: boolean;
  compact?: boolean;
}

export const MarketCard = ({ market, featured = false, compact = false }: MarketCardProps) => {
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = 100 - yesPercent;

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume}`;
  };

  // Compact variant for horizontal lists
  if (compact) {
    return (
      <Link to={`/market/${market.id}`} className="block group">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-border hover:shadow-sm transition-all duration-200">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
            <img src={market.image} alt="" className="w-full h-full object-cover opacity-80" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm leading-snug line-clamp-1 text-foreground group-hover:text-foreground/80 transition-colors">
              {market.question}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{formatVolume(market.volume)} vol</span>
              <span className="text-border">·</span>
              <span>{formatDistanceToNow(market.endDate, { addSuffix: false })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-semibold text-success tabular-nums">
              {yesPercent}¢
            </span>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-sm font-semibold text-danger tabular-nums">
              {noPercent}¢
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/market/${market.id}`} className="block group h-full">
      <div className={cn(
        "relative h-full rounded-xl overflow-hidden",
        "bg-card border border-border/50",
        "transition-all duration-300 ease-out",
        "hover:border-border hover:shadow-md hover:shadow-black/5",
        "dark:hover:shadow-black/20",
        featured && "lg:flex lg:flex-row"
      )}>
        {/* Image Section with Subtle Overlay */}
        <div className={cn(
          "relative overflow-hidden bg-muted",
          featured ? "lg:w-[40%] h-44 lg:h-auto" : "h-36"
        )}>
          <img
            src={market.image}
            alt={market.question}
            className="w-full h-full object-cover opacity-40 dark:opacity-30 transition-opacity duration-500 group-hover:opacity-50"
          />
          
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-card/40 via-transparent to-card/60" />
          
          {/* Category Badge - Pill Style */}
          <div className="absolute top-3 left-3">
            <div className="px-2.5 py-1 rounded-full bg-secondary/90 dark:bg-secondary/80 backdrop-blur-sm text-[11px] font-medium text-secondary-foreground">
              {market.category}
            </div>
          </div>

          {/* Hover Arrow */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
            <div className="w-7 h-7 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center border border-border/50">
              <ArrowUpRight className="h-3.5 w-3.5 text-foreground" />
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className={cn(
          "flex flex-col p-4",
          featured ? "lg:flex-1 lg:p-5 lg:justify-between" : ""
        )}>
          {/* Market Question */}
          <h3 className={cn(
            "font-semibold leading-snug tracking-tight line-clamp-2 text-foreground",
            "group-hover:text-foreground/80 transition-colors",
            featured ? "text-lg lg:text-xl mb-4" : "text-sm mb-3"
          )}>
            {market.question}
          </h3>

          {/* Yes/No Price Badges - Clean Outlined Style */}
          <div className="flex items-center gap-2 mb-4">
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-success/30 bg-success/5 hover:bg-success/10 transition-colors">
              <span className="text-xs font-medium text-success uppercase tracking-wide">Yes</span>
              <span className="text-sm font-bold text-success tabular-nums">{yesPercent}¢</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-danger/30 bg-danger/5 hover:bg-danger/10 transition-colors">
              <span className="text-xs font-medium text-danger uppercase tracking-wide">No</span>
              <span className="text-sm font-bold text-danger tabular-nums">{noPercent}¢</span>
            </button>
          </div>

          {/* Minimal Progress Bar */}
          <div className="mb-4">
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-success/60 to-success/40 transition-all duration-500"
                style={{ width: `${yesPercent}%` }}
              />
            </div>
          </div>

          {/* Stats Section - Clean Tabular Style */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-success/70" />
              <span className="font-medium">{formatVolume(market.volume)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span className="font-medium">{market.participants.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-medium">{formatDistanceToNow(market.endDate, { addSuffix: false })}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
