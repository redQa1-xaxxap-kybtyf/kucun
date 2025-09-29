import { Suspense } from 'react';

import { ERPSalesOrderList } from '@/components/sales-orders/erp-sales-order-list';
import { SalesOrderListSkeleton } from '@/components/sales-orders/sales-order-list-skeleton';
import { getSalesOrders } from '@/lib/api/handlers/sales-orders';
import { paginationConfig } from '@/lib/env';

/**
 * 销售订单页面 - 使用服务器组件优化首屏加载
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 */
export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 等待并解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const status = params.status as
    | 'draft'
    | 'confirmed'
    | 'shipped'
    | 'completed'
    | 'cancelled'
    | undefined;
  const customerId = (params.customerId as string) || '';
  const sortBy =
    (params.sortBy as
      | 'orderNumber'
      | 'createdAt'
      | 'updatedAt'
      | 'totalAmount'
      | 'status') || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  // 服务器端获取初始数据
  const initialData = await getSalesOrders({
    page,
    limit,
    search,
    status,
    customerId,
    sortBy,
    sortOrder,
  });

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <Suspense fallback={<SalesOrderListSkeleton />}>
        <ERPSalesOrderList
          _initialData={{
            data: initialData.data,
            pagination: initialData.pagination,
          }}
          initialParams={{
            page,
            limit,
            search,
            status,
            customerId,
            sortBy,
            sortOrder,
          }}
        />
      </Suspense>
    </div>
  );
}
