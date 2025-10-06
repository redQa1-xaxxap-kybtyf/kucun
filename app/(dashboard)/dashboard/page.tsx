// 仪表盘主页面 - 使用服务器组件优化首屏加载
// 基于shadcn/ui组件库的完整仪表盘实现
// 严格遵循全栈开发执行手册和项目统一约定规范

import { ERPDashboard } from '@/components/dashboard/erp-dashboard';
import { getDashboardData } from '@/lib/api/handlers/dashboard';
import { prisma } from '@/lib/db';

/**
 * 仪表盘主页面组件 - 使用服务器组件优化首屏加载
 * 使用ERP风格的紧凑布局设计
 *
 * 优化策略：
 * 1. RSC 预取所有首屏数据（仪表盘统计 + 订单列表 + 厂家发货）
 * 2. 客户端组件仅负责 UI 交互和状态管理
 * 3. TanStack Query 仅用于用户主动刷新/筛选时的数据获取
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 解析查询参数 (Next.js 15 需要 await searchParams)
  const params = await searchParams;
  const timeRange = (params.timeRange as string) || '7d';

  // 🚀 并行获取所有首屏数据 - 避免瀑布式请求
  const [dashboardData, recentOrders, pendingOrders, factoryShipments] =
    await Promise.all([
      // 仪表盘统计数据
      getDashboardData(timeRange as '1d' | '7d' | '30d' | '90d' | '1y' | 'all'),

      // 最近订单（最新10条）
      prisma.salesOrder.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, name: true },
          },
          items: {
            select: { id: true },
          },
        },
      }),

      // 待处理订单（草稿状态）
      prisma.salesOrder.findMany({
        where: { status: 'draft' },
        take: 10,
        orderBy: { createdAt: 'asc' },
        include: {
          customer: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, name: true },
          },
          items: {
            select: { id: true },
          },
        },
      }),

      // 厂家发货订单（最新8条）
      prisma.factoryShipmentOrder.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPDashboard
        initialData={dashboardData}
        initialTimeRange={timeRange}
        initialOrders={{
          recent: recentOrders,
          pending: pendingOrders,
          shipments: factoryShipments,
        }}
      />
    </div>
  );
}
