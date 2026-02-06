import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MarketCardSkeletonProps {
  featured?: boolean;
}

export const MarketCardSkeleton = ({ featured = false }: MarketCardSkeletonProps) => {
  return (
    <div className={cn(
      "overflow-hidden h-full rounded-xl bg-card border border-border/50",
      featured && "lg:flex lg:flex-row"
    )}>
      {/* Image Section Skeleton */}
      <div className={cn(
        "relative overflow-hidden bg-muted",
        featured ? "lg:w-[40%] h-44 lg:h-auto" : "h-36"
      )}>
        <Skeleton className="w-full h-full rounded-none" />
        {/* Category pill skeleton */}
        <div className="absolute top-3 left-3">
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>

      {/* Content Section */}
      <div className={cn(
        "flex flex-col p-4",
        featured && "lg:flex-1 lg:p-5 lg:justify-between"
      )}>
        {/* Title Skeleton */}
        <div className="mb-3">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        {/* Yes/No buttons skeleton */}
        <div className="flex gap-2 mb-4">
          <Skeleton className="flex-1 h-10 rounded-lg" />
          <Skeleton className="flex-1 h-10 rounded-lg" />
        </div>

        {/* Progress bar skeleton */}
        <Skeleton className="h-1 w-full rounded-full mb-4" />

        {/* Footer Stats Skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
};