import { getSalesOrders } from '@/lib/api/handlers/sales-orders';
import { paginationConfig } from '@/lib/env';

import { SalesOrdersPageClient } from './page-client';

/**
 * 销售订单页面 - 使用服务器组件优化首屏加载
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 *
 * ✅ Next.js 15 最佳实践：
 * - Route Segment Config 配置
 * - Server Component 数据获取
 * - Suspense 渐进式渲染
 */

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
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

  const queryParams = {
    page,
    limit,
    search,
    status,
    customerId,
    sortBy,
    sortOrder,
  };

  // 服务器端获取初始数据
  const initialData = await getSalesOrders(queryParams);

  return (
    <SalesOrdersPageClient
      initialData={{
        data: initialData.data,
        pagination: initialData.pagination,
      }}
      initialParams={queryParams}
    />
  );
}
