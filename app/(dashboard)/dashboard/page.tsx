// 仪表盘主页面 - 使用服务器组件优化首屏加载
// 基于shadcn/ui组件库的完整仪表盘实现
// 严格遵循全栈开发执行手册和项目统一约定规范

import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { getServerSession } from 'next-auth';

import { ERPDashboard } from '@/components/dashboard/erp-dashboard';
import { dashboardQueryKeys } from '@/lib/api/dashboard';
import { getDashboardData } from '@/lib/api/handlers/dashboard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type {
  DashboardFactoryShipmentSummary,
  DashboardSalesOrderSummary,
} from '@/lib/types/dashboard';

/**
 * 仪表盘主页面组件 - 使用服务器组件优化首屏加载
 * 使用ERP风格的紧凑布局设计
 *
 * ✅ Next.js 15.4 + TanStack Query v5 最佳实践：
 * 1. RSC 预取所有首屏数据（仪表盘统计 + 订单列表 + 厂家发货）
 * 2. HydrationBoundary 水合数据到客户端，避免重复请求
 * 3. staleTime=Infinity 防止客户端首次渲染时重新请求
 * 4. 客户端组件仅负责 UI 交互和用户主动刷新
 */

// ✅ Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 解析查询参数 (Next.js 15 需要 await searchParams)
  const params = await searchParams;
  const timeRange = (params.timeRange as string) || '7d';

  // ✅ 创建 QueryClient（启用 Streaming Queries）
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
      },
    },
  });

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

  const session = await getServerSession(authOptions);

  const toCustomerSummary = (
    customer: { id: string; name: string | null } | null | undefined
  ) =>
    customer
      ? {
          id: customer.id,
          name: customer.name ?? null,
        }
      : undefined;

  const mapSalesOrders = (
    orders: typeof recentOrders
  ): DashboardSalesOrderSummary[] =>
    orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status as DashboardSalesOrderSummary['status'],
      totalAmount: Number(order.totalAmount ?? 0),
      createdAt: order.createdAt.toISOString(),
      customer: toCustomerSummary(order.customer),
    }));

  const mapFactoryShipments = (
    orders: typeof factoryShipments
  ): DashboardFactoryShipmentSummary[] =>
    orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status as DashboardFactoryShipmentSummary['status'],
      totalAmount: Number(order.totalAmount ?? 0),
      createdAt: order.createdAt.toISOString(),
      customer: toCustomerSummary(order.customer),
    }));

  const recentOrderSummaries = mapSalesOrders(recentOrders);
  const pendingOrderSummaries = mapSalesOrders(pendingOrders);
  const factoryShipmentSummaries = mapFactoryShipments(factoryShipments);

  // ✅ 将服务端数据预设到 QueryClient（避免客户端重复请求）
  queryClient.setQueryData(
    dashboardQueryKeys.overview(),
    dashboardData.overview
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ERPDashboard
        userName={session?.user?.name ?? null}
        initialData={dashboardData}
        initialTimeRange={timeRange}
        initialOrders={{
          recent: recentOrderSummaries,
          pending: pendingOrderSummaries,
          shipments: factoryShipmentSummaries,
        }}
      />
    </HydrationBoundary>
  );
}
