// 客户对账单API客户端
// 基于TanStack Query实现客户对账单查询、详情、统计等API调用函数

import { useQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

import type {
  CustomerStatementQuery,
  CustomerStatementDetail,
  CustomerStatementListResponse,
  CustomerStatementStatistics,
} from '@/lib/types/customer-statement';

const DEPRECATION_MESSAGE =
  '客户对账单接口已下线，请改用统一的 /api/finance/statements 服务';

export const customerStatementQueryKeys = {
  all: ['customer-statements'] as const satisfies QueryKey,
  lists: () =>
    [...customerStatementQueryKeys.all, 'list'] as const satisfies QueryKey,
  list: (query: CustomerStatementQuery) =>
    [...customerStatementQueryKeys.lists(), query] as const satisfies QueryKey,
  details: () =>
    [...customerStatementQueryKeys.all, 'detail'] as const satisfies QueryKey,
  detail: (customerId: string, startDate: string, endDate: string) =>
    [
      ...customerStatementQueryKeys.details(),
      customerId,
      startDate,
      endDate,
    ] as const satisfies QueryKey,
  statistics: () =>
    [
      ...customerStatementQueryKeys.all,
      'statistics',
    ] as const satisfies QueryKey,
};

export const customerStatementApi = {
  getStatements: async () => {
    throw new Error(DEPRECATION_MESSAGE);
  },
  getStatementDetail: async () => {
    throw new Error(DEPRECATION_MESSAGE);
  },
  getStatistics: async () => {
    throw new Error(DEPRECATION_MESSAGE);
  },
  exportStatement: async () => {
    throw new Error(DEPRECATION_MESSAGE);
  },
};

export const useCustomerStatements = (
  query?: CustomerStatementQuery,
  options?: { enabled?: boolean }
) =>
  useQuery<
    CustomerStatementListResponse['data'],
    Error,
    CustomerStatementListResponse['data']
  >({
    queryKey: customerStatementQueryKeys.list(query ?? {}),
    queryFn: (): Promise<CustomerStatementListResponse['data']> =>
      Promise.reject(new Error(DEPRECATION_MESSAGE)),
    enabled: options?.enabled ?? false,
  });

export const useCustomerStatementDetail = (
  customerId: string,
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean }
) =>
  useQuery<CustomerStatementDetail, Error, CustomerStatementDetail>({
    queryKey: customerStatementQueryKeys.detail(customerId, startDate, endDate),
    queryFn: (): Promise<CustomerStatementDetail> =>
      Promise.reject(new Error(DEPRECATION_MESSAGE)),
    enabled: options?.enabled ?? false,
  });

export const useCustomerStatementStatistics = (
  query?: CustomerStatementQuery,
  options?: { enabled?: boolean }
) =>
  useQuery<CustomerStatementStatistics, Error, CustomerStatementStatistics>({
    queryKey: customerStatementQueryKeys.statistics(),
    queryFn: (): Promise<CustomerStatementStatistics> =>
      Promise.reject(new Error(DEPRECATION_MESSAGE)),
    enabled: options?.enabled ?? false,
  });
