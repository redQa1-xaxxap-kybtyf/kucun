import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';

import { paginationConfig } from '@/lib/env';
import type { PurchaseOrderStatus } from '@/lib/types/purchase-order';

import { PurchaseOrdersPageClient } from './page-client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const status = params.status as PurchaseOrderStatus | undefined;
  const supplierId = (params.supplierId as string) || undefined;
  const sortBy = (params.sortBy as string) || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  const startDateStr = (params.startDate as string) || undefined;
  const endDateStr = (params.endDate as string) || undefined;

  const queryParams = {
    page,
    limit,
    containerNumber: search,
    status,
    supplierId,
    sortBy,
    sortOrder,
    startDate: startDateStr ? new Date(startDateStr) : undefined,
    endDate: endDateStr ? new Date(endDateStr) : undefined,
  };

  const queryClient = new QueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PurchaseOrdersPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}
