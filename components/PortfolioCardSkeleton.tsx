import { Card, CardContent } from '@/components/ui/card';

export const StatsCardSkeleton = () => {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded skeleton-shimmer" />
          <div className="h-3 w-20 rounded skeleton-shimmer" />
        </div>
        <div className="h-8 w-24 rounded skeleton-shimmer mb-2" />
        <div className="h-3 w-16 rounded skeleton-shimmer" />
      </CardContent>
    </Card>
  );
};

export const ChartSkeleton = () => {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 w-28 rounded skeleton-shimmer" />
          <div className="flex gap-1">
            <div className="h-7 w-10 rounded skeleton-shimmer" />
            <div className="h-7 w-10 rounded skeleton-shimmer" />
            <div className="h-7 w-10 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="h-[220px] w-full rounded-lg skeleton-shimmer" />
      </CardContent>
    </Card>
  );
};

export const AllocationSkeleton = () => {
  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6">
        <div className="h-5 w-24 rounded skeleton-shimmer mb-6" />
        <div className="flex justify-center mb-4">
          <div className="w-32 h-32 rounded-full skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full skeleton-shimmer" />
              <div className="h-3 w-16 rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const PositionSkeleton = () => {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl glass-card">
      <div className="hidden sm:block w-12 h-12 rounded-lg skeleton-shimmer flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 rounded skeleton-shimmer" />
        <div className="h-3 w-32 rounded skeleton-shimmer" />
      </div>
      <div className="text-right space-y-2">
        <div className="h-4 w-16 rounded skeleton-shimmer ml-auto" />
        <div className="h-3 w-12 rounded skeleton-shimmer ml-auto" />
      </div>
    </div>
  );
};
