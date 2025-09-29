import { Suspense } from 'react';

import { ERPProductList } from '@/components/products/erp-product-list';
import { ProductListSkeleton } from '@/components/products/product-list-skeleton';
import type { ProductListQueryParams } from '@/lib/api/products';
import { paginationConfig, productConfig } from '@/lib/env';

// 临时创建一个服务器端的产品获取函数
async function getProducts(params: ProductListQueryParams) {
  // 构建查询参数
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.search) searchParams.set('search', params.search);
  if (params.categoryId) searchParams.set('categoryId', params.categoryId);
  if (params.status) searchParams.set('status', params.status);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params.includeInventory !== undefined)
    searchParams.set('includeInventory', params.includeInventory.toString());
  if (params.includeStatistics !== undefined)
    searchParams.set('includeStatistics', params.includeStatistics.toString());

  // 调用内部 API - 使用相对路径避免端口硬编码
  const baseUrl =
    process.env.NODE_ENV === 'development'
      ? `http://localhost:${process.env.PORT || 3000}`
      : '';
  const response = await fetch(
    `${baseUrl}/api/products?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`获取产品列表失败: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取产品列表失败');
  }

  return result.data;
}

/**
 * 产品管理页面 - 使用服务器组件优化首屏加载
 * 严格遵循全栈项目统一约定规范
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 等待并解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const categoryId = (params.categoryId as string) || '';
  const status = (params.status as 'active' | 'inactive') || 'active';
  const sortBy = (params.sortBy as string) || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';
  const includeInventory =
    params.includeInventory === 'true' || productConfig.defaultIncludeInventory;
  const includeStatistics =
    params.includeStatistics === 'true' ||
    productConfig.defaultIncludeStatistics;

  // 服务器端获取初始数据
  const initialData = await getProducts({
    page,
    limit,
    search,
    categoryId,
    status,
    sortBy,
    sortOrder,
    includeInventory,
    includeStatistics,
  });

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <Suspense fallback={<ProductListSkeleton />}>
          <ERPProductList
            _initialData={initialData}
            initialParams={{
              page,
              limit,
              search,
              categoryId,
              status,
              sortBy,
              sortOrder,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
