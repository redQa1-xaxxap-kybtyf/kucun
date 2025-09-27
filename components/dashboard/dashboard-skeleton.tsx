import { Skeleton } from '@/components/ui/skeleton';

/**
 * 仪表盘骨架屏组件
 * 用于服务器组件加载时的占位显示
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* 欢迎信息和操作栏骨架 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="border-b bg-muted/10 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      </div>

      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded border bg-card">
            <div className="border-b bg-muted/30 px-3 py-2">
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="px-3 py-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 图表和活动区域骨架 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 销售趋势图骨架 */}
        <div className="lg:col-span-2">
          <div className="rounded border bg-card">
            <div className="border-b bg-muted/30 px-3 py-2">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-12 w-8" />
                    <Skeleton className="h-6 w-8" />
                    <Skeleton className="h-10 w-8" />
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-14 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 最近活动骨架 */}
        <div className="lg:col-span-1">
          <div className="rounded border bg-card">
            <div className="border-b bg-muted/30 px-3 py-2">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="px-3 py-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 快捷操作骨架 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
