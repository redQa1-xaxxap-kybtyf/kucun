import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';

import { inventoryQueryKeys } from '@/hooks/use-optimized-inventory-query';
import { getCategoriesServer } from '@/lib/api/categories-server';
import { formatPaginatedResponse } from '@/lib/api/inventory-formatter';
import {
  getInventoryCount,
  getOptimizedInventoryList,
} from '@/lib/api/inventory-query-builder';
import { paginationConfig } from '@/lib/env';
import type { InventoryQueryParams } from '@/lib/types/inventory';

import { InventoryPageClient } from './page-client';

/**
 * 库存管理页面 - Server Component
 *
 * ✅ Next.js 15.4 最佳实践：
 * 1. Route Segment Config - 明确缓存策略
 * 2. Server Components - 服务端数据获取
 * 3. HydrationBoundary - SSR 数据传递
 * 4. Streaming - 支持渐进式渲染
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
 */

// ✅ Route Segment Config - Next.js 15 最佳实践
export const dynamic = 'force-dynamic'; // 强制动态渲染（库存数据实时性要求高）
export const fetchCache = 'force-no-store'; // 禁用 fetch 缓存
export const runtime = 'nodejs'; // 使用 Node.js 运行时（需要数据库连接）
export const revalidate = 0; // 禁用 ISR

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const getParam = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const parsePositiveNumber = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const page = parsePositiveNumber(getParam('page'), 1);
  const limit = parsePositiveNumber(
    getParam('limit'),
    paginationConfig.defaultPageSize
  );
  const search = getParam('search') ?? '';
  const categoryId = getParam('categoryId') ?? '';
  const lowStock = getParam('lowStock') === 'true';
  const hasStock = getParam('hasStock') === 'true';
  const sortBy =
    (getParam('sortBy') as InventoryQueryParams['sortBy']) || 'updatedAt';
  const sortOrder = getParam('sortOrder') === 'asc' ? 'asc' : 'desc';

  const queryParams: InventoryQueryParams = {
    page,
    limit,
    search,
    categoryId,
    lowStock,
    hasStock,
    sortBy,
    sortOrder,
  };

  // ✅ TanStack Query v5 最佳实践：在组件内创建 QueryClient，避免数据泄漏
  // 启用 Streaming Queries (v5.40+)
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        // ✅ 允许 pending queries 序列化，支持 Streaming SSR
        shouldDehydrateQuery: () => true,
      },
    },
  });

  // 并行获取初始数据并预取到 QueryClient
  const [inventoryRecords, total, categoriesResult] = await Promise.all([
    getOptimizedInventoryList(queryParams),
    getInventoryCount(queryParams),
    getCategoriesServer({
      page: 1,
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc',
    }),
  ]);

  // 转换分类数据格式（API返回的已经是ISO字符串格式）
  const categoryOptions = categoriesResult.data.map(cat => ({
    id: cat.id,
    name: cat.name,
    code: cat.code,
    status: cat.status,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
    sortOrder: cat.sortOrder,
  }));

  // ✅ 格式化响应数据（统一格式）
  const formattedData = formatPaginatedResponse(
    inventoryRecords,
    total,
    queryParams.page || 1,
    queryParams.limit || 20
  );

  // ✅ 将服务端数据预设到 QueryClient（使用统一格式，无需额外映射）
  const inventoryData = {
    success: true,
    data: formattedData,
  };

  queryClient.setQueryData(inventoryQueryKeys.list(queryParams), inventoryData);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InventoryPageClient
        initialParams={queryParams}
        categoryOptions={categoryOptions}
      />
    </HydrationBoundary>
  );
}
