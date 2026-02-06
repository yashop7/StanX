import { Skeleton } from '@/components/ui/skeleton';

export const TradingChartSkeleton = () => {
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      
      {/* Chart Area */}
      <div className="p-5">
        <Skeleton className="w-full h-[300px] rounded-xl" />
      </div>
    </div>
  );
};