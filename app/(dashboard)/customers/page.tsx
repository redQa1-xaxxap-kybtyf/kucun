import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';

import { getCustomerList } from '@/lib/api/customer-handlers';
import { queryKeys } from '@/lib/api/query-keys';
import { paginationConfig } from '@/lib/env';
import type { CustomerQueryParams } from '@/lib/types/customer';

import { CustomersPageClient } from './page-client';

/**
 * 客户管理页面 - Server Component
 * 负责数据获取和 SEO 优化
 * 严格遵循前端架构规范：三级组件架构
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const sortBy =
    (params.sortBy as
      | 'name'
      | 'createdAt'
      | 'updatedAt'
      | 'totalOrders'
      | 'totalAmount'
      | 'transactionCount'
      | 'cooperationDays'
      | 'returnOrderCount') || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  const queryParams: CustomerQueryParams = {
    page,
    limit,
    search: search || undefined,
    sortBy,
    sortOrder,
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  const initialData = await getCustomerList(queryParams);

  queryClient.setQueryData(queryKeys.customers.list(queryParams), initialData);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CustomersPageClient
        initialParams={{
          page,
          limit,
          search: search || undefined,
          sortBy,
          sortOrder,
        }}
      />
    </HydrationBoundary>
  );
}
