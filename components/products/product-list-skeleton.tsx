import { Skeleton } from '@/components/ui/skeleton';

/**
 * 产品列表骨架屏组件
 * 用于服务器组件加载时的占位显示
 */
export function ProductListSkeleton() {
  return (
    <div className="space-y-4">
      {/* 搜索和筛选区域骨架 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>

      {/* 表格骨架 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>

        {/* 表头骨架 */}
        <div className="border-b bg-muted/10 px-3 py-2">
          <div className="grid grid-cols-8 gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* 表格行骨架 */}
        <div className="divide-y">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="px-3 py-3">
              <div className="grid grid-cols-8 gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <div className="flex gap-1">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 分页骨架 */}
        <div className="border-t bg-muted/10 px-3 py-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
