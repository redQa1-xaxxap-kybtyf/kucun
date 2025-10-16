/**
 * 统一的 React Query Keys 工厂
 * 遵循 TanStack Query 最佳实践
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 */

import type { ProductListQueryParams } from '@/lib/api/products';
import type { CustomerQueryParams } from '@/lib/types/customer';
import type { SupplierQueryParams } from '@/lib/types/supplier';

/**
 * Query Keys 工厂
 * 采用层级结构：[feature, action, ...params]
 */
export const queryKeys = {
  // 客户管理
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (params: CustomerQueryParams) =>
      [...queryKeys.customers.lists(), params] as const,
    details: () => [...queryKeys.customers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
  },

  // 供应商管理
  suppliers: {
    all: ['suppliers'] as const,
    lists: () => [...queryKeys.suppliers.all, 'list'] as const,
    list: (params: SupplierQueryParams) =>
      [...queryKeys.suppliers.lists(), params] as const,
    details: () => [...queryKeys.suppliers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.suppliers.details(), id] as const,
  },

  // 产品管理
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (params: ProductListQueryParams) =>
      [...queryKeys.products.lists(), params] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
  },
} as const;
