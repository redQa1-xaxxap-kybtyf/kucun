import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import type { Metadata } from 'next';

import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import type { ReceivablesParams } from '@/lib/schemas/receivables-params';
import {
  getReceivables,
  type PaymentStatus,
} from '@/lib/services/receivables-service';

import { ReceivablesPageClient } from './page-client';

export const metadata: Metadata = {
  title: '应收货款管理 - 财务管理',
  description: '管理销售订单产生的应收账款，跟踪收款状态',
};

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 应收货款管理页面 - Server Component
 *
 * ✅ Next.js 15.4 最佳实践：
 * 1. Route Segment Config - 明确缓存策略
 * 2. Server Component 数据获取
 * 3. Suspense 渐进式渲染
 */
export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = parseInt((params.page as string) || '1', 10);
  const limit = parseInt(
    (params.limit as string) || `${paginationConfig.defaultPageSize}`,
    10
  );
  const search = (params.search as string) || '';
  const paymentStatus =
    (params.paymentStatus as PaymentStatus) ||
    (params.status as PaymentStatus) ||
    undefined;
  const sortBy = (params.sortBy as string) || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';
  const startDate = (params.startDate as string) || undefined;
  const endDate = (params.endDate as string) || undefined;

  const queryParams = {
    page,
    limit,
    search,
    paymentStatus,
    sortBy: sortBy as ReceivablesParams['sortBy'],
    sortOrder,
    startDate,
    endDate,
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  // 服务器端获取初始数据
  const initialData = await getReceivables({
    page,
    limit,
    search,
    paymentStatus,
    sortBy,
    sortOrder,
    startDate,
    endDate,
  });

  queryClient.setQueryData(queryKeys.finance.receivablesList(queryParams), {
    data: initialData,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReceivablesPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}
