import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';

import { getSalesOrders } from '@/lib/api/handlers/sales-orders';
import { salesOrderQueryKeys } from '@/lib/api/sales-orders';
import { paginationConfig } from '@/lib/env';
import type { SalesOrderQueryParams } from '@/lib/types/sales-order';

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

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getBooleanParam(value: string | string[] | undefined) {
  return getParamValue(value) === 'true' ? true : undefined;
}

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 等待并解析查询参数
  const params = await searchParams;
  const page = Number(getParamValue(params.page)) || 1;
  const limit =
    Number(getParamValue(params.limit)) || paginationConfig.defaultPageSize;
  const search = getParamValue(params.search) || '';
  const status = getParamValue(params.status) as
    | 'pending'
    | 'draft'
    | 'confirmed'
    | 'shipped'
    | 'completed'
    | 'cancelled'
    | undefined;
  const customerId = getParamValue(params.customerId) || '';
  const sortBy =
    (getParamValue(params.sortBy) as
      | 'orderNumber'
      | 'orderDate'
      | 'createdAt'
      | 'updatedAt'
      | 'totalAmount'
      | 'status'
      | 'shippedAt') || 'orderDate';
  const sortOrder =
    (getParamValue(params.sortOrder) as 'asc' | 'desc') || 'desc';
  const startDate = getParamValue(params.startDate) || undefined;
  const endDate = getParamValue(params.endDate) || undefined;
  const orderType = getParamValue(params.orderType) as
    | SalesOrderQueryParams['orderType']
    | undefined;
  const recordScope: SalesOrderQueryParams['recordScope'] =
    getParamValue(params.recordScope) === 'history' ? 'history' : undefined;
  const includeTest = getBooleanParam(params.includeTest);
  const includeVoided = getBooleanParam(params.includeVoided);

  const queryParams = {
    page,
    limit,
    search,
    status,
    customerId,
    userId: getParamValue(params.userId) || '',
    sortBy,
    sortOrder,
    startDate,
    endDate,
    orderType,
    isSampleOrder: getBooleanParam(params.isSampleOrder),
    hasReturns: getBooleanParam(params.hasReturns),
    recordScope,
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
