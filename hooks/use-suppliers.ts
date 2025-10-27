/**
 * 供应商管理 React Query Hooks
 * 遵循 TanStack Query 最佳实践
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { supplierQueryKeys, getSuppliers } from '@/lib/api/suppliers';
import type { SupplierQueryParams } from '@/lib/types/supplier';

type SuppliersResponse = Awaited<ReturnType<typeof getSuppliers>>;
type SuppliersQueryKey = ReturnType<typeof supplierQueryKeys.list>;

/**
 * 供应商列表查询 Hook
 */
export function useSuppliers(
  params: SupplierQueryParams = {},
  options?: Omit<
    UseQueryOptions<
      SuppliersResponse,
      Error,
      SuppliersResponse,
      SuppliersQueryKey
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<
    SuppliersResponse,
    Error,
    SuppliersResponse,
    SuppliersQueryKey
  >({
    queryKey: supplierQueryKeys.list(params),
    queryFn: () => getSuppliers(params),
    staleTime: 5 * 60 * 1000, // 5分钟内数据视为新鲜
    gcTime: 10 * 60 * 1000, // 10分钟后垃圾回收
    ...options,
  });
}
