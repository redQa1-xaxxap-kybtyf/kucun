/**
 * 财务列表骨架屏组件
 *
 * ✅ 最佳实践：
 * - 提供视觉加载反馈
 * - 渐进式动画效果
 * - 匹配实际内容布局
 */
export function FinanceListSkeleton() {
  return (
    <div className="space-y-4">
      {/* 统计卡片骨架 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="bg-card rounded-lg border p-6"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
              <div className="h-8 w-32 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
            </div>
          </div>
        ))}
      </div>

      {/* 搜索和筛选骨架 */}
      <div className="flex items-center gap-4">
        <div className="h-10 flex-1 animate-pulse rounded-md bg-[hsl(var(--color-border-secondary))]" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-[hsl(var(--color-border-secondary))]" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-[hsl(var(--color-border-secondary))]" />
      </div>

      {/* 表格骨架 */}
      <div className="bg-card rounded-lg border">
        {/* 表头 */}
        <div className="border-b p-4">
          <div className="grid grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]"
                style={{ animationDelay: `${i * 30}ms` }}
              />
            ))}
          </div>
        </div>

        {/* 表格行 */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(row => (
          <div key={row} className="border-b p-4 last:border-b-0">
            <div className="grid grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(col => (
                <div
                  key={col}
                  className="h-4 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]"
                  style={{ animationDelay: `${(row * 6 + col) * 30}ms` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 分页骨架 */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-48 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-10 w-10 animate-pulse rounded bg-[hsl(var(--color-border-secondary))]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
