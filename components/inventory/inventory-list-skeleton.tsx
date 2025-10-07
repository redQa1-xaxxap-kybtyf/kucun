/**
 * 库存列表骨架屏组件
 * Next.js 15 最佳实践：配合 Suspense 提供优雅的加载状态
 */
export function InventoryListSkeleton() {
  return (
    <div className="space-y-4">
      {/* 工具栏骨架 */}
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>

      {/* 筛选器骨架 */}
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
              <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>

      {/* 表格骨架 */}
      <div className="bg-card rounded-lg border shadow-sm">
        {/* 表头 */}
        <div className="border-b bg-gray-50 p-4">
          <div className="grid grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-4 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        </div>

        {/* 表格行 */}
        {[1, 2, 3, 4, 5].map(row => (
          <div key={row} className="border-b p-4 last:border-b-0">
            <div className="grid grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(col => (
                <div
                  key={col}
                  className="h-4 animate-pulse rounded bg-gray-200"
                  style={{
                    animationDelay: `${(row * 6 + col) * 50}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 分页骨架 */}
      <div className="bg-card flex justify-between rounded-lg border p-4 shadow-sm">
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

/**
 * 简化的加载骨架（用于小组件）
 */
export function InventoryCardSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-gray-200" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex justify-between">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
