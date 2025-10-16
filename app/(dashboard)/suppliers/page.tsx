import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import type { Metadata } from 'next';

import { SuppliersPageClient } from '@/components/suppliers/suppliers-page-client';
import { supplierQueryKeys } from '@/lib/api/suppliers';
import { paginationConfig } from '@/lib/env';
import { getSuppliers } from '@/lib/services/supplier-service';
import type { Supplier, SupplierQueryParams } from '@/lib/types/supplier';

export const metadata: Metadata = {
  title: '供应商管理',
  description: '管理供应商信息',
};

/**
 * 供应商管理页面
 *
 * ✅ Next.js 15 最佳实践：
 * - Server Component 架构
 * - Route Segment Config 缓存控制
 * - 直接服务端数据获取
 * - 类型安全的 searchParams
 */

// ============================================
// Route Segment Config
// ============================================

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const status =
    (params.status as 'active' | 'inactive' | undefined) || undefined;
  const allowedSortFields: SupplierQueryParams['sortBy'][] = [
    'name',
    'createdAt',
    'updatedAt',
  ];
  const sortByParam = (params.sortBy as string) || 'createdAt';
  const normalizedSortBy: SupplierQueryParams['sortBy'] =
    allowedSortFields.includes(sortByParam as SupplierQueryParams['sortBy'])
      ? (sortByParam as SupplierQueryParams['sortBy'])
      : 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  const queryParams: SupplierQueryParams = {
    page,
    limit,
    search: search || undefined,
    status: status === undefined ? undefined : status,
    sortBy: normalizedSortBy,
    sortOrder,
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  const initialData = await getSuppliers({
    page: queryParams.page ?? 1,
    limit: queryParams.limit ?? paginationConfig.defaultPageSize,
    search: queryParams.search ?? '',
    status: queryParams.status,
    sortBy: queryParams.sortBy ?? 'createdAt',
    sortOrder: queryParams.sortOrder ?? 'desc',
  });

  const serializedData = {
    data: initialData.suppliers.map<Supplier>(supplier => ({
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone ?? undefined,
      address: supplier.address ?? undefined,
      status: supplier.status as Supplier['status'],
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    })),
    pagination: initialData.pagination,
  };

  queryClient.setQueryData(supplierQueryKeys.list(queryParams), serializedData);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SuppliersPageClient
        initialParams={{
          page,
          limit,
          search: search || undefined,
          status,
          sortBy: normalizedSortBy,
          sortOrder,
        }}
      />
    </HydrationBoundary>
  );
}
