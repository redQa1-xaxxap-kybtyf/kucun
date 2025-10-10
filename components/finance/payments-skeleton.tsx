/**
 * 收款记录列表骨架屏
 *
 * ✅ Next.js 15 最佳实践：
 * - Suspense fallback 组件
 * - 匹配实际布局结构
 * - 渐进式动画效果
 */
export function PaymentsSkeleton() {
  return (
    <div className="space-y-6">
      {/* 统计卡片骨架 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="rounded-lg border border-[hsl(var(--color-success-light))] bg-[hsl(var(--color-success-light))] p-6"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="space-y-3">
              <div className="h-4 w-20 animate-pulse rounded bg-[hsl(var(--color-success-light))]" />
              <div className="h-8 w-32 animate-pulse rounded bg-[hsl(var(--color-success-light))]" />
              <div className="h-3 w-24 animate-pulse rounded bg-[hsl(var(--color-success-light))]" />
            </div>
          </div>
        ))}
      </div>

      {/* 搜索筛选骨架 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 flex-1 animate-pulse rounded-md bg-[hsl(var(--color-border-secondary))]" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-[hsl(var(--color-border-secondary))]" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-[hsl(var(--color-border-secondary))]" />
        <div className="h-10 w-24 animate-pulse rounded-md bg-[hsl(var(--color-border-secondary))]" />
      </div>

      {/* 表格骨架 */}
      <div className="bg-card rounded-lg border shadow-sm">
        {/* 表头 */}
        <div className="border-b bg-[hsl(var(--color-bg-secondary))] p-4">
          <div className="grid grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-[hsl(var(--color-border-primary))]"
                style={{ animationDelay: `${i * 30}ms` }}
              />
            ))}
          </div>
        </div>

        {/* 数据行骨架 */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(row => (
          <div
            key={row}
            className="border-b p-4 last:border-b-0 hover:bg-[hsl(var(--color-bg-secondary))]"
          >
            <div className="grid grid-cols-7 gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map(col => (
                <div
                  key={col}
                  className="h-4 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]"
                  style={{ animationDelay: `${(row * 7 + col) * 20}ms` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 分页骨架 */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
        <div className="flex gap-2">
          <div className="h-10 w-20 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-10 w-10 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]"
            />
          ))}
          <div className="h-10 w-20 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
        </div>
      </div>
    </div>
  );
}
