import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import { transformFactoryShipmentListResponse } from '@/lib/api/factory-shipments';
import { getFactoryShipmentOrdersServer } from '@/lib/api/factory-shipments-server';
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import type { FactoryShipmentStatus } from '@/lib/types/factory-shipment';

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

  const rawModeParam = params.mode;
  const modeParam = Array.isArray(rawModeParam)
    ? rawModeParam[0]
    : rawModeParam;
  const mode: 'factory' | 'customer_direct' =
    modeParam === 'factory' || modeParam === 'customer_direct'
      ? modeParam
      : 'factory';

  // 如果未带 mode 或 mode 非法，统一重定向到带 mode 的 URL，保证菜单/面包屑语义一致
  if (modeParam !== mode) {
    const nextParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(v => nextParams.append(key, v));
        return;
      }
      nextParams.set(key, value);
    });
    nextParams.set('mode', mode);
    redirect(`/factory-shipments?${nextParams.toString()}`);
  }

  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const status = params.status as FactoryShipmentStatus | undefined;
  const sortBy = (params.sortBy as string) || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  // 日期筛选参数 - 转换为 Date 对象传递给服务端
  const startDateStr = (params.startDate as string) || undefined;
  const endDateStr = (params.endDate as string) || undefined;

  const queryParams = {
    page,
    limit,
    mode,
    search, // ✅ 保留原始 search 参数，用于 OR 逻辑搜索
    status,
    sortBy,
    sortOrder,
    startDate: startDateStr ? new Date(startDateStr) : undefined,
    endDate: endDateStr ? new Date(endDateStr) : undefined,
  };

  // ✅ 创建 QueryClient 用于服务端预取
  const queryClient = new QueryClient();

  // ✅ 服务端获取数据
  const rawData = await getFactoryShipmentOrdersServer(queryParams);

  // ✅ P0修复: 转换为客户端期望的数据结构
  // 修复前：SSR 预填充 { data, total, page, limit }，客户端期望 { orders, pagination }
  // 修复后：SSR 和客户端使用相同的数据结构，避免首屏闪烁和重复请求
  const transformedData = transformFactoryShipmentListResponse(rawData);

  // ✅ 使用 setQueryData 预填充缓存（而非 prefetchQuery）
  queryClient.setQueryData(
    queryKeys.factoryShipments.list(queryParams),
    transformedData
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FactoryShipmentsPageClient initialParams={queryParams} />
    </HydrationBoundary>
  );
}
