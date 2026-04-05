import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';

import { getBatchSpecifications } from '@/lib/api/batch-specification-handlers';
import { requirePagePermission } from '@/lib/auth/page-permission';
import { queryKeys } from '@/lib/queryKeys';
import type { BatchSpecificationQueryParams } from '@/lib/types/batch-specification';

import { BatchSpecificationPageClient } from './page-client';

export const metadata: Metadata = {
  title: '批次管理 - 库存管理',
  description: '管理产品批次规格参数，维护每批次的片数、重量等信息',
};

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_SORT_BY: NonNullable<BatchSpecificationQueryParams['sortBy']> =
  'createdAt';
const DEFAULT_SORT_ORDER: NonNullable<
  BatchSpecificationQueryParams['sortOrder']
> = 'desc';

function normalizeParams(
  raw: Record<string, string | string[] | undefined>
): Required<
  Pick<BatchSpecificationQueryParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>
> &
  Omit<
    BatchSpecificationQueryParams,
    'page' | 'limit' | 'sortBy' | 'sortOrder'
  > {
  const parseSingle = (value?: string | string[]) => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  const pageRaw = parseSingle(raw.page);
  const limitRaw = parseSingle(raw.limit);
  const sortByRaw = parseSingle(raw.sortBy);
  const sortOrderRaw = parseSingle(raw.sortOrder);
  const searchRaw = parseSingle(raw.search);
  const productIdRaw = parseSingle(raw.productId);
  const variantIdRaw = parseSingle(raw.variantId);
  const batchNumberRaw = parseSingle(raw.batchNumber);

  const pageParsed = Number.parseInt(pageRaw ?? '', 10);
  const limitParsed = Number.parseInt(limitRaw ?? '', 10);

  const page =
    Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : DEFAULT_PAGE;
  const limit =
    Number.isFinite(limitParsed) && limitParsed > 0 && limitParsed <= 100
      ? limitParsed
      : DEFAULT_LIMIT;

  const allowedSortFields: Required<
    NonNullable<BatchSpecificationQueryParams['sortBy']>
  >[] = ['createdAt', 'batchNumber', 'piecesPerUnit', 'weight'];
  const sortBy =
    sortByRaw &&
    allowedSortFields.includes(sortByRaw as (typeof allowedSortFields)[number])
      ? (sortByRaw as (typeof allowedSortFields)[number])
      : DEFAULT_SORT_BY;

  const sortOrder =
    sortOrderRaw === 'asc' || sortOrderRaw === 'desc'
      ? (sortOrderRaw as 'asc' | 'desc')
      : DEFAULT_SORT_ORDER;

  return {
    page,
    limit,
    sortBy,
    sortOrder,
    ...(searchRaw && searchRaw.trim() ? { search: searchRaw.trim() } : {}),
    ...(productIdRaw && productIdRaw.trim()
      ? { productId: productIdRaw.trim() }
      : {}),
    ...(variantIdRaw && variantIdRaw.trim()
      ? { variantId: variantIdRaw.trim() }
      : {}),
    ...(batchNumberRaw && batchNumberRaw.trim()
      ? { batchNumber: batchNumberRaw.trim() }
      : {}),
  };
}

export default async function BatchSpecificationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ✅ 权限检查：要求用户拥有库存查看权限
  await requirePagePermission('inventory:view');

  const resolvedParams = searchParams ? await searchParams : {};
  const normalizedParams = normalizeParams(resolvedParams);

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  const listResponse = await getBatchSpecifications({
    page: normalizedParams.page,
    limit: normalizedParams.limit,
    sortBy: normalizedParams.sortBy ?? DEFAULT_SORT_BY,
    sortOrder: normalizedParams.sortOrder ?? DEFAULT_SORT_ORDER,
    search: normalizedParams.search,
    productId: normalizedParams.productId,
    variantId: normalizedParams.variantId,
    batchNumber: normalizedParams.batchNumber,
  });

  queryClient.setQueryData(
    queryKeys.inventory.batchSpecificationsList(normalizedParams),
    listResponse
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BatchSpecificationPageClient
        initialParams={normalizedParams}
        initialData={listResponse}
      />
    </HydrationBoundary>
  );
}
