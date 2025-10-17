import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import type { Metadata } from 'next';

import { paginationConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { financeKeys } from '@/lib/queryKeys';
import {
  buildRefundQueryParams,
  fetchRefundsList,
  sanitizeRefundSearchParams,
} from '@/lib/services/refund-query-service';
import type { RefundListQueryParams } from '@/lib/types/refund';
import { refundQuerySchema } from '@/lib/validations/refund';

import { RefundsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '应退货款管理 - 财务管理',
  description: '管理退货订单产生的应退账款，跟踪退款处理状态',
};

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

type RefundSearchParams = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
};

async function getRefundsData(searchParams: RefundSearchParams) {
  const sanitizedParams = sanitizeRefundSearchParams(searchParams);

  const validationResult = refundQuerySchema.safeParse(sanitizedParams);
  const parsedParams = validationResult.success ? validationResult.data : {};

  if (!validationResult.success && process.env.NODE_ENV !== 'production') {
    logger.warn(
      'finance-refunds',
      '[RefundsPage] Query params validation failed',
      undefined,
      {
        issues: validationResult.error.issues,
        params: sanitizedParams,
      }
    );
  }

  const {
    page = 1,
    limit = paginationConfig.defaultPageSize,
    search = '',
    status,
    sortBy = 'refundDate',
    sortOrder = 'desc',
  } = parsedParams;

  return fetchRefundsList({
    page,
    limit,
    search,
    status,
    sortBy,
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
  });
}

/**
 * 应退货款管理页面 - 服务器组件
 * 使用服务器端数据获取，优化首屏加载和SEO
 */
export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<RefundSearchParams>;
}) {
  const params = await searchParams;
  const refundsData = await getRefundsData(params);

  const sanitizedParams = sanitizeRefundSearchParams(params);
  const validationResult = refundQuerySchema.safeParse(sanitizedParams);
  const validatedParams = validationResult.success ? validationResult.data : {};

  if (!validationResult.success && process.env.NODE_ENV !== 'production') {
    logger.warn(
      'finance-refunds',
      '[RefundsPage] Query params validation failed (initialParams)',
      undefined,
      {
        issues: validationResult.error.issues,
        params: sanitizedParams,
      }
    );
  }

  const queryParams: RefundListQueryParams = buildRefundQueryParams({
    page: validatedParams.page ?? 1,
    limit: validatedParams.limit ?? paginationConfig.defaultPageSize,
    search: validatedParams.search,
    status: validatedParams.status,
    sortBy: validatedParams.sortBy as RefundListQueryParams['sortBy'],
    sortOrder: validatedParams.sortOrder as 'asc' | 'desc',
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  queryClient.setQueryData(financeKeys.refundsList(queryParams), refundsData);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RefundsPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}
