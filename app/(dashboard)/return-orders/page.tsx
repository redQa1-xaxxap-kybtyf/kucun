import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';

import { getReturnOrdersServer } from '@/lib/api/return-orders-server';
import { queryKeys } from '@/lib/queryKeys';
import type {
  ReturnOrderStatus,
  ReturnOrderType,
  ReturnProcessType,
} from '@/lib/types/return-order';

import { ReturnOrdersPageClient } from './page-client';

const RETURN_ORDER_STATUS_VALUES: ReturnOrderStatus[] = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'processing',
  'completed',
  'cancelled',
] as const;

const RETURN_ORDER_TYPE_VALUES: ReturnOrderType[] = [
  'quality_issue',
  'wrong_product',
  'customer_change',
  'damage_in_transit',
  'remaining_return',
  'other',
] as const;

const RETURN_PROCESS_TYPE_VALUES: ReturnProcessType[] = [
  'refund',
  'exchange',
] as const;

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    type?: string;
    processType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    startDate?: string;
    endDate?: string;
  }>;
}

/**
 * 退货订单管理页面
 *
 * ✅ Next.js 15 + React Query 最佳实践：
 * 1. Route Segment Config - 明确缓存策略
 * 2. Server Components - 服务端数据获取
 * 3. HydrationBoundary - SSR 数据传递（关键！）
 * 4. QueryClient.setQueryData - 预填充缓存
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
 */

// ============================================
// Route Segment Config
// ============================================

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
export default async function ReturnOrdersPage({ searchParams }: PageProps) {
  // 解析查询参数
  const params = await searchParams;
  const isReturnOrderStatus = (value?: string): value is ReturnOrderStatus =>
    typeof value === 'string' &&
    (RETURN_ORDER_STATUS_VALUES as readonly string[]).includes(value);
  const isReturnOrderType = (value?: string): value is ReturnOrderType =>
    typeof value === 'string' &&
    (RETURN_ORDER_TYPE_VALUES as readonly string[]).includes(value);
  const isReturnProcessType = (
    value?: string
  ): value is ReturnProcessType =>
    typeof value === 'string' &&
    (RETURN_PROCESS_TYPE_VALUES as readonly string[]).includes(value);
  const initialParams = {
    page: params?.page ? parseInt(params.page, 10) : 1,
    limit: params?.limit ? parseInt(params.limit, 10) : 20,
    search: params?.search || '',
    status: isReturnOrderStatus(params?.status) ? params?.status : undefined,
    type: isReturnOrderType(params?.type) ? params?.type : undefined,
    processType: isReturnProcessType(params?.processType)
      ? params?.processType
      : undefined,
    sortBy: params?.sortBy || 'createdAt',
    sortOrder: (params?.sortOrder as 'asc' | 'desc') || 'desc',
    startDate: params?.startDate || undefined,
    endDate: params?.endDate || undefined,
  };

  // ✅ 创建 QueryClient 用于服务端预取
  const queryClient = new QueryClient();

  // ✅ 服务端获取初始数据（直接查询数据库）
  const initialData = await getReturnOrdersServer(initialParams);

  // ✅ 使用 setQueryData 预填充缓存（而不是通过 props）
  // 注意: initialData 是 ReturnOrderListResponse 类型,包含 { success, data: { returnOrders, pagination } }
  queryClient.setQueryData(
    queryKeys.returnOrders.list(initialParams),
    initialData
  );

  return (
    // ✅ 使用 HydrationBoundary 传递 QueryClient 状态
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReturnOrdersPageClient initialParams={initialParams} />
    </HydrationBoundary>
  );
}
