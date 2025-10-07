import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';

import {
  adjustmentQueryKeys,
  getAdjustmentQueryOptions,
} from '@/lib/api/adjustments';
import { getAdjustmentsServer } from '@/lib/api/adjustments-server';

import { AdjustmentRecordsPageClient } from './page-client';

/**
 * 库存调整记录页面 - Server Component
 *
 * ✅ Next.js 15.4 最佳实践：
 * 1. Route Segment Config - 明确缓存策略
 * 2. Server Component 预取数据
 * 3. HydrationBoundary 数据传递
 * 4. Streaming Queries 支持
 */

// ✅ Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function AdjustmentRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const urlSearchParams = new URLSearchParams();

  // 构建 URLSearchParams
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(v => urlSearchParams.append(key, v));
      } else {
        urlSearchParams.append(key, value);
      }
    }
  });

  // 默认查询参数
  if (!urlSearchParams.has('page')) {
    urlSearchParams.set('page', '1');
  }
  if (!urlSearchParams.has('limit')) {
    urlSearchParams.set('limit', '20');
  }
  if (!urlSearchParams.has('sortBy')) {
    urlSearchParams.set('sortBy', 'createdAt');
  }
  if (!urlSearchParams.has('sortOrder')) {
    urlSearchParams.set('sortOrder', 'desc');
  }

  // ✅ 创建 QueryClient（启用 Streaming Queries）
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydratePendingQuery: true,
      },
    },
  });

  // 服务端预取数据
  const adjustmentData = await getAdjustmentsServer(urlSearchParams);

  // 构建查询参数对象
  const queryParams = {
    page: Number(urlSearchParams.get('page')),
    limit: Number(urlSearchParams.get('limit')),
    search: urlSearchParams.get('search') || undefined,
    productId: urlSearchParams.get('productId') || undefined,
    variantId: urlSearchParams.get('variantId') || undefined,
    batchNumber: urlSearchParams.get('batchNumber') || undefined,
    reason: urlSearchParams.get('reason') || undefined,
    status: urlSearchParams.get('status') || undefined,
    operatorId: urlSearchParams.get('operatorId') || undefined,
    startDate: urlSearchParams.get('startDate') || undefined,
    endDate: urlSearchParams.get('endDate') || undefined,
    sortBy:
      (urlSearchParams.get('sortBy') as
        | 'createdAt'
        | 'adjustmentNumber'
        | 'quantity'
        | 'reason') || 'createdAt',
    sortOrder: (urlSearchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };

  // 设置查询缓存
  queryClient.setQueryData(adjustmentQueryKeys.list(queryParams), {
    adjustments: adjustmentData.adjustments,
    pagination: adjustmentData.pagination,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdjustmentRecordsPageClient />
    </HydrationBoundary>
  );
}
