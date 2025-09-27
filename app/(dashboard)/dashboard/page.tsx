// 仪表盘主页面 - 使用服务器组件优化首屏加载
// 基于shadcn/ui组件库的完整仪表盘实现
// 严格遵循全栈开发执行手册和项目统一约定规范

import { Suspense } from 'react';

import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ERPDashboard } from '@/components/dashboard/erp-dashboard';
import { getDashboardData } from '@/lib/api/handlers/dashboard';

/**
 * 仪表盘主页面组件 - 使用服务器组件优化首屏加载
 * 使用ERP风格的紧凑布局设计
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // 解析查询参数
  const timeRange = (searchParams.timeRange as string) || '7d';

  // 服务器端获取初始数据
  const initialData = await getDashboardData({
    timeRange: timeRange as '1d' | '7d' | '30d' | '90d' | '1y' | 'all',
  });

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <ERPDashboard initialData={initialData} initialTimeRange={timeRange} />
      </Suspense>
    </div>
  );
}
