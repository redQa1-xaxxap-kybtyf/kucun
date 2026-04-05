import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';

import { getSalesOrders } from '@/lib/api/handlers/sales-orders';
import { salesOrderQueryKeys } from '@/lib/api/sales-orders';
import { paginationConfig } from '@/lib/env';

import { SalesOrdersPageClient } from './page-client';

/**
 * 销售订单页面 - Server Component
 *
 * ✅ Next.js 15 + React Query 最佳实践：
 * 1. Route Segment Config - 明确缓存策略
 * 2. Server Components - 服务端数据获取
 * 3. HydrationBoundary - SSR 数据传递（关键！）
 * 4. QueryClient.setQueryData - 预填充缓存
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
 */

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 等待并解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const status = params.status as
    | 'pending'
    | 'draft'
    | 'confirmed'
    | 'shipped'
    | 'completed'
    | 'cancelled'
    | undefined;
  const customerId = (params.customerId as string) || '';
  const sortBy =
    (params.sortBy as
      | 'orderNumber'
      | 'createdAt'
      | 'updatedAt'
      | 'totalAmount'
      | 'status') || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';
  const startDate = (params.startDate as string) || undefined;
  const endDate = (params.endDate as string) || undefined;
  const includeTest = params.includeTest === 'true' ? true : undefined;
  const includeVoided = params.includeVoided === 'true' ? true : undefined;

  const queryParams = {
    page,
    limit,
    search,
    status,
    customerId,
    sortBy,
    sortOrder,
    startDate,
    endDate,
    includeTest,
    includeVoided,
  };

  // ✅ TanStack Query v5 最佳实践：在组件内创建 QueryClient
  const queryClient = new QueryClient();

  // 服务器端获取初始数据
  const initialData = await getSalesOrders(queryParams);

  // ✅ 关键修复：将数据预设到 QueryClient（而不是通过 props）
  queryClient.setQueryData(salesOrderQueryKeys.list(queryParams), {
    data: initialData.data,
    pagination: initialData.pagination,
  });

  return (
    // ✅ 使用 HydrationBoundary 传递 QueryClient 状态
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SalesOrdersPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}
