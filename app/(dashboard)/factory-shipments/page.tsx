import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';

import { factoryShipmentQueryKeys } from '@/lib/api/factory-shipments';
import { getFactoryShipmentOrdersServer } from '@/lib/api/factory-shipments-server';
import { paginationConfig } from '@/lib/env';
import type {
  FactoryShipmentQueryParams,
  FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

import { FactoryShipmentsPageClient } from './page-client';

/**
 * 厂家发货订单页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 * 服务端组件 - 优先使用 App Router SSR，在服务端预取数据
 *
 * ✅ Next.js 15 最佳实践：
 * - Route Segment Config 配置
 * - Server Component 数据预取
 * - TanStack Query HydrationBoundary
 */

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
export default async function FactoryShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 等待并解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const status = params.status as FactoryShipmentStatus | undefined;
  const sortBy = (params.sortBy as string) || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  // 日期筛选参数 - 保持字符串格式，避免序列化问题
  const startDate = (params.startDate as string) || undefined;
  const endDate = (params.endDate as string) || undefined;

  const queryParams = {
    page,
    limit,
    containerNumber: search, // 将 search 映射到 containerNumber
    status,
    sortBy,
    sortOrder,
    startDate,
    endDate,
  };

  // ✅ 创建 QueryClient 用于服务端预取
  const queryClient = new QueryClient();

  // ✅ 服务端获取数据
  const initialData = await getFactoryShipmentOrdersServer(queryParams);

  // ✅ 使用 setQueryData 预填充缓存（而非 prefetchQuery）
  queryClient.setQueryData(factoryShipmentQueryKeys.list(queryParams), {
    data: initialData.data,
    pagination: initialData.pagination,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FactoryShipmentsPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}
