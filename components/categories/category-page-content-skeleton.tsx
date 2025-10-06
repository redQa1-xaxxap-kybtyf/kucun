import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 分类页面内容骨架屏
 * 用于 CategoryPageContent 组件的加载状态
 */
export function CategoryPageContentSkeleton() {
  return (
    <div className="space-y-6">
      {/* 页面标题和操作按钮骨架 */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      {/* 内容卡片骨架 */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

