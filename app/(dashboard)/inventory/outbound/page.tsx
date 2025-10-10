import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';

import { getOutboundRecordsServer } from '@/lib/api/outbound-server';
import { queryKeys } from '@/lib/queryKeys';
import type { OutboundRecordQueryParams } from '@/lib/types/inventory';

import { OutboundRecordsPageClient } from './page-client';

/**
 * 出库记录页面 - Server Component
 *
 * ✅ Next.js 15.4 最佳实践
 */

// ✅ Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function OutboundRecordsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
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
  ensureParam('limit', '50');

  const parsePositiveNumber = (raw: string | null, fallback: number) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const page = parsePositiveNumber(urlSearchParams.get('page'), 1);
  const limit = parsePositiveNumber(urlSearchParams.get('limit'), 50);
  urlSearchParams.set('page', page.toString());
  urlSearchParams.set('limit', limit.toString());

  const getOptional = (key: string) => {
    const value = urlSearchParams.get(key);
    return value && value.trim() !== '' ? value : undefined;
  };

  // ✅ 创建 QueryClient（启用 Streaming Queries）
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydratePendingQuery: true,
      },
    },
  });

  // 服务端预取数据
  const outboundData = await getOutboundRecordsServer(urlSearchParams);

  const queryParams: OutboundRecordQueryParams = {
    page,
    limit,
    type: getOptional('type') as OutboundRecordQueryParams['type'],
    startDate: getOptional('startDate'),
    endDate: getOptional('endDate'),
    search: getOptional('search'),
  };

  // 设置查询缓存
  queryClient.setQueryData(
    queryKeys.inventory.outboundsList(queryParams),
    {
      data: outboundData.data,
      pagination: outboundData.pagination,
    }
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OutboundRecordsPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}

