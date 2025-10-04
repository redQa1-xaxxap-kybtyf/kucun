import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 退货订单列表加载骨架屏
 * 用于 Suspense fallback
 */
export function ReturnOrderListSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center space-x-4 flex-1">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

