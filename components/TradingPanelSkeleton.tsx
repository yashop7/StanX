import { Skeleton } from '@/components/ui/skeleton';

export const TradingPanelSkeleton = () => {
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40">
        <Skeleton className="h-5 w-24" />
      </div>

      <div className="p-5 space-y-5">
        {/* Segmented Control */}
        <div className="p-1 bg-muted/40 rounded-xl">
          <div className="grid grid-cols-4 gap-0.5">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Buy/Sell Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>

        {/* Price Display */}
        <Skeleton className="h-14 rounded-xl" />

        {/* Amount Input */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 rounded-xl" />
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <Skeleton className="h-28 rounded-xl" />

        {/* Trade Button */}
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  );
};