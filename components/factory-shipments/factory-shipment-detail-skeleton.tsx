/**
 * 厂家发货订单详情页骨架屏
 *
 * ✅ Next.js 15 最佳实践：
 * - Suspense fallback 组件
 * - 匹配实际布局结构
 * - 渐进式动画效果
 */
export function FactoryShipmentDetailSkeleton() {
  return (
    <div className="space-y-4">
      {/* 页面头部骨架 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-48 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
          <div className="h-6 w-20 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-20 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
          <div className="h-9 w-20 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
          <div className="h-9 w-9 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧内容骨架 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 基本信息卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-[hsl(var(--color-border-strong))]" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
                  <div
                    className="h-5 w-32 animate-pulse rounded bg-[hsl(var(--color-border-strong))]"
                    style={{ animationDelay: `${i * 30}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 产品明细卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-[hsl(var(--color-border-strong))]" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="space-y-2 border-b pb-4 last:border-b-0"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-48 animate-pulse rounded bg-[hsl(var(--color-border-strong))]" />
                      <div className="h-4 w-32 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
                      <div className="h-4 w-40 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-5 w-24 animate-pulse rounded bg-[hsl(var(--color-border-strong))]" />
                      <div className="h-4 w-32 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 临时产品卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-40 animate-pulse rounded bg-[hsl(var(--color-border-strong))]" />
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
                  <div
                    className="h-4 w-3/4 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]"
                    style={{ animationDelay: `${i * 30}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧侧边栏骨架 */}
        <div className="space-y-6">
          {/* 金额汇总卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-[hsl(var(--color-border-strong))]" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
                  <div
                    className="h-4 w-32 animate-pulse rounded bg-[hsl(var(--color-border-strong))]"
                    style={{ animationDelay: `${i * 30}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 操作历史卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-[hsl(var(--color-border-strong))]" />
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--color-primary))]" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 w-24 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
                    <div
                      className="h-3 w-32 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]"
                      style={{ animationDelay: `${i * 30}ms` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
