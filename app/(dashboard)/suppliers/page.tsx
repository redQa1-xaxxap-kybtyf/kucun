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
import { SupplierQuerySchema } from '@/lib/validations/supplier';

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

  const normalizedParams = Object.entries(params).reduce<
    Record<string, string>
  >((acc, [key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0 && value[0] !== undefined) {
        acc[key] = value[0] as string;
      }
    } else if (value !== undefined) {
      acc[key] = value as string;
    }
    return acc;
  }, {});

  const parsedParams = SupplierQuerySchema.parse(normalizedParams);
  const search = parsedParams.search?.trim();
  const status = parsedParams.status;

  const queryParams: SupplierQueryParams = {
    page: parsedParams.page ?? 1,
    limit: parsedParams.limit ?? paginationConfig.defaultPageSize,
    search: search ? search : undefined,
    status,
    sortBy: parsedParams.sortBy ?? 'createdAt',
    sortOrder: parsedParams.sortOrder ?? 'desc',
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
      supplierCode: supplier.supplierCode ?? undefined,
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
          page: queryParams.page ?? 1,
          limit: queryParams.limit ?? paginationConfig.defaultPageSize,
          search: search || undefined,
          status,
          sortBy: queryParams.sortBy ?? 'createdAt',
          sortOrder: queryParams.sortOrder ?? 'desc',
        }}
      />
    </HydrationBoundary>
  );
}
