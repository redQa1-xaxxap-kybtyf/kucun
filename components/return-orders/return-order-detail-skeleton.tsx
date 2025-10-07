/**
 * 退货订单详情页骨架屏
 *
 * ✅ Next.js 15 最佳实践：
 * - Suspense fallback 组件
 * - 匹配实际布局结构
 * - 渐进式动画效果
 */
export function ReturnOrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* 页面头部骨架 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-48 animate-pulse rounded bg-orange-300" />
          <div className="h-6 w-20 animate-pulse rounded bg-orange-200" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧内容骨架 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 基本信息卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-orange-300" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                  <div
                    className="h-5 w-32 animate-pulse rounded bg-orange-300"
                    style={{ animationDelay: `${i * 30}ms` }}
                  />
                </div>
              ))}
            </div>
            {/* 备注信息骨架 */}
            <div className="mt-4 space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
              <div className="h-12 w-full animate-pulse rounded bg-gray-100" />
            </div>
          </div>

          {/* 退货明细卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-orange-300" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="space-y-2 border-b pb-3 last:border-b-0"
                >
                  <div className="flex justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-48 animate-pulse rounded bg-gray-300" />
                      <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-5 w-20 animate-pulse rounded bg-orange-300" />
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧侧边栏骨架 */}
        <div className="space-y-6">
          {/* 金额汇总卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-orange-300" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  <div
                    className="h-4 w-20 animate-pulse rounded bg-orange-300"
                    style={{ animationDelay: `${i * 30}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 操作历史卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-orange-300" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-orange-300" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    <div
                      className="h-3 w-32 animate-pulse rounded bg-gray-200"
                      style={{ animationDelay: `${i * 30}ms` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 快速操作卡片骨架 */}
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-orange-300" />
            <div className="space-y-2">
              <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
