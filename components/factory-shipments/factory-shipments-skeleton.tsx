/**
 * 厂家发货订单列表骨架屏
 *
 * ✅ Next.js 15 最佳实践：
 * - Suspense fallback 组件
 * - 匹配实际布局结构
 * - 渐进式动画效果
 */
export function FactoryShipmentsSkeleton() {
  return (
    <div className="space-y-6">
      {/* 搜索筛选骨架 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 flex-1 animate-pulse rounded-md bg-gray-200" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-gray-200" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-gray-200" />
        <div className="h-10 w-24 animate-pulse rounded-md bg-gray-200" />
      </div>

      {/* 表格骨架 */}
      <div className="bg-card rounded-lg border shadow-sm">
        {/* 表头 */}
        <div className="border-b bg-gray-50 p-4">
          <div className="grid grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-gray-300"
                style={{ animationDelay: `${i * 30}ms` }}
              />
            ))}
          </div>
        </div>

        {/* 数据行骨架 */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(row => (
          <div
            key={row}
            className="border-b p-4 last:border-b-0 hover:bg-gray-50"
          >
            <div className="grid grid-cols-7 gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map(col => (
                <div
                  key={col}
                  className="h-4 animate-pulse rounded bg-gray-200"
                  style={{ animationDelay: `${(row * 7 + col) * 20}ms` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 分页骨架 */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-10 w-20 animate-pulse rounded bg-gray-200" />
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-10 w-10 animate-pulse rounded bg-gray-200"
            />
          ))}
          <div className="h-10 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
