import { Suspense } from 'react';

import { InventoryListSkeleton } from '@/components/inventory/inventory-list-skeleton';
import { getCategoryOptions } from '@/lib/api/categories';
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
 * 负责数据获取和 SEO 优化
 * 严格遵循前端架构规范：三级组件架构
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const categoryId = (params.categoryId as string) || '';
  const lowStock = params.lowStock === 'true';
  const hasStock = params.hasStock === 'true';
  const sortBy =
    (params.sortBy as InventoryQueryParams['sortBy']) || 'updatedAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

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

  // 并行获取初始数据
  const [inventoryRecords, total, categoryOptions] = await Promise.all([
    getOptimizedInventoryList(queryParams),
    getInventoryCount(queryParams),
    getCategoryOptions(),
  ]);

  // 格式化响应数据
  const initialData = formatPaginatedResponse(
    inventoryRecords,
    total,
    queryParams.page || 1,
    queryParams.limit || 20
  );

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <Suspense fallback={<InventoryListSkeleton />}>
        <InventoryPageClient
          initialData={initialData}
          initialParams={queryParams}
          categoryOptions={categoryOptions}
        />
      </Suspense>
    </div>
  );
}
