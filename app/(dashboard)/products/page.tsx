import { Suspense } from 'react';

import { ERPProductList } from '@/components/products/erp-product-list';
import { ProductListSkeleton } from '@/components/products/product-list-skeleton';
import { paginationConfig, productConfig } from '@/lib/env';

// 临时创建一个服务器端的产品获取函数
async function getProducts(params: {
  page: number;
  limit: number;
  search: string;
  categoryId: string;
  status: string;
  sortBy: string;
  sortOrder: string;
  includeInventory: boolean;
  includeStatistics: boolean;
}) {
  // 构建查询参数
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
    search: params.search,
    categoryId: params.categoryId,
    status: params.status,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    includeInventory: params.includeInventory.toString(),
    includeStatistics: params.includeStatistics.toString(),
  });

  // 调用内部 API - 使用相对路径避免端口硬编码
  const baseUrl =
    process.env.NODE_ENV === 'development'
      ? `http://localhost:${process.env.PORT || 3001}`
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
  const status = (params.status as string) || 'active';
  const sortBy = (params.sortBy as string) || 'createdAt';
  const sortOrder = (params.sortOrder as string) || 'desc';
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
            initialData={initialData}
            initialParams={{
              page,
              limit,
              search,
              categoryId,
              status,
              sortBy,
              sortOrder,
              includeInventory,
              includeStatistics,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
