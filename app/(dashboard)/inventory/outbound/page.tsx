import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';

import { getOutboundRecordsServer } from '@/lib/api/outbound-server';
import { queryKeys } from '@/lib/queryKeys';

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
    urlSearchParams.set('limit', '50');
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
  const outboundData = await getOutboundRecordsServer(urlSearchParams);

  // 设置查询缓存
  queryClient.setQueryData(queryKeys.inventory.outbounds(), {
    data: outboundData.data,
    pagination: outboundData.pagination,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OutboundRecordsPageClient />
    </HydrationBoundary>
  );
}
