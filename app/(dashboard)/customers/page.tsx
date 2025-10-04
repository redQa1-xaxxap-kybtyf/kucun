import { Suspense } from 'react';

import { CustomerListSkeleton } from '@/components/customers/customer-list-skeleton';
import { getCustomerList } from '@/lib/api/customer-handlers';
import { paginationConfig } from '@/lib/env';
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

  // 服务器端获取初始数据
  const initialData = await getCustomerList({
    page,
    limit,
    search,
    sortBy,
    sortOrder,
  });

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <Suspense fallback={<CustomerListSkeleton />}>
        <CustomersPageClient
          initialData={initialData}
          initialParams={{ page, limit, search, sortBy, sortOrder }}
        />
      </Suspense>
    </div>
  );
}
