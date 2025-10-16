/**
 * 客户管理 React Query Hooks
 * 遵循 TanStack Query 最佳实践
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import type { CustomerQueryParams } from '@/lib/types/customer';

type CustomersResponse = Awaited<ReturnType<typeof getCustomers>>;
type CustomersQueryKey = ReturnType<typeof customerQueryKeys.list>;

/**
 * 客户列表查询 Hook
 */
export function useCustomersQuery(
  params: CustomerQueryParams,
  options?: Omit<
    UseQueryOptions<
      CustomersResponse,
      Error,
      CustomersResponse,
      CustomersQueryKey
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<
    CustomersResponse,
    Error,
    CustomersResponse,
    CustomersQueryKey
  >({
    queryKey: customerQueryKeys.list(params),
    queryFn: () => getCustomers(params),
    staleTime: 5 * 60 * 1000, // 5分钟内数据视为新鲜
    gcTime: 10 * 60 * 1000, // 10分钟后垃圾回收
    ...options,
  });
}
