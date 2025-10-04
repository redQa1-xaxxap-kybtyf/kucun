import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 供应商列表加载骨架屏
 */
export function SupplierListSkeleton() {
  return (
    <div className="space-y-4">
      {/* 搜索和筛选骨架 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 表格骨架 */}
      <Card>
        <CardHeader>
          <CardTitle>供应商列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
