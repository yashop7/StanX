import { Skeleton } from '@/components/ui/skeleton';

export const OrderBookSkeleton = () => {
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      
      {/* Table Header */}
      <div className="px-5 py-2 border-b border-border/40">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-8 ml-auto" />
          <Skeleton className="h-3 w-10 ml-auto" />
        </div>
      </div>
      
      {/* Asks */}
      <div className="px-5 py-2 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={`ask-${i}`} className="grid grid-cols-3 gap-4">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-12 ml-auto" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
      
      {/* Mid Price */}
      <div className="px-5 py-3 border-y border-border/40">
        <Skeleton className="h-6 w-32 mx-auto" />
      </div>
      
      {/* Bids */}
      <div className="px-5 py-2 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={`bid-${i}`} className="grid grid-cols-3 gap-4">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-12 ml-auto" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};