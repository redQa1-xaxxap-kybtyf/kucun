import type { Metadata } from 'next';

import { paginationConfig } from '@/lib/env';
import type { PaymentStatus } from '@/lib/services/receivables-service';
import { getReceivables } from '@/lib/services/receivables-service';

import { ReceivablesPageClient } from './page-client';

export const metadata: Metadata = {
  title: '应收货款管理 - 财务管理',
  description: '管理销售订单产生的应收账款，跟踪收款状态和逾期情况',
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
  const status = (params.status as PaymentStatus) || undefined;
  const sortBy = (params.sortBy as string) || 'orderDate';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  const queryParams = {
    page,
    limit,
    search,
    status,
    sortBy,
    sortOrder,
  };

  // 服务器端获取初始数据
  const initialData = await getReceivables({
    page,
    limit,
    search,
    paymentStatus: status,
    sortBy,
    sortOrder,
  });

  return (
    <ReceivablesPageClient
      initialData={initialData}
      initialParams={queryParams}
    />
  );
}
