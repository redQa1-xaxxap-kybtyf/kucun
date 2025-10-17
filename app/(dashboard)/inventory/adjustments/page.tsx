import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';

import { adjustmentQueryKeys } from '@/lib/api/adjustments';
import { getAdjustmentsServer } from '@/lib/api/adjustments-server';
import { requirePagePermission } from '@/lib/auth/page-permission';
import type { AdjustmentQueryParams } from '@/lib/types/inventory';

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
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // ✅ 权限检查：要求用户拥有库存查看权限（调整记录是查看性质）
  await requirePagePermission('inventory:view');

  const urlSearchParams = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value
        .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
        .forEach(v => urlSearchParams.append(key, String(v)));
    } else if (String(value).trim() !== '') {
      urlSearchParams.append(key, value as string);
    }
  });

  const ensureParam = (key: string, fallback: string) => {
    const current = urlSearchParams.get(key);
    if (!current || current.trim() === '') {
      urlSearchParams.set(key, fallback);
    }
  };

  // 默认查询参数
  ensureParam('page', '1');
  ensureParam('limit', '20');
  ensureParam('sortBy', 'createdAt');
  ensureParam('sortOrder', 'desc');

  const parsePositiveNumber = (raw: string | null, fallback: number) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const page = parsePositiveNumber(urlSearchParams.get('page'), 1);
  const limit = parsePositiveNumber(urlSearchParams.get('limit'), 20);
  urlSearchParams.set('page', page.toString());
  urlSearchParams.set('limit', limit.toString());

  const getOptional = (key: string) => {
    const value = urlSearchParams.get(key);
    return value && value.trim() !== '' ? value : undefined;
  };

  const sortByValue = urlSearchParams.get('sortBy') || 'createdAt';
  const sortOrderValue: 'asc' | 'desc' =
    urlSearchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  // ✅ 创建 QueryClient（启用 Streaming Queries）
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  // 服务端预取数据
  const adjustmentData = await getAdjustmentsServer(urlSearchParams);

  // 构建查询参数对象
  const queryParams: AdjustmentQueryParams = {
    page,
    limit,
    search: getOptional('search'),
    productId: getOptional('productId'),
    variantId: getOptional('variantId'),
    batchNumber: getOptional('batchNumber'),
    reason: getOptional('reason') as AdjustmentQueryParams['reason'],
    status: getOptional('status') as AdjustmentQueryParams['status'],
    operatorId: getOptional('operatorId'),
    startDate: getOptional('startDate'),
    endDate: getOptional('endDate'),
    sortBy: sortByValue as AdjustmentQueryParams['sortBy'],
    sortOrder: sortOrderValue,
  };

  // 设置查询缓存
  queryClient.setQueryData(adjustmentQueryKeys.list(queryParams), {
    adjustments: adjustmentData.adjustments,
    pagination: adjustmentData.pagination,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdjustmentRecordsPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}
