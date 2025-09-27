import { Suspense } from 'react';

import { ERPProductList } from '@/components/products/erp-product-list';
import { ProductListSkeleton } from '@/components/products/product-list-skeleton';
import { getProducts } from '@/lib/api/handlers/products';
import { paginationConfig, productConfig } from '@/lib/env';

/**
 * 产品管理页面 - 使用服务器组件优化首屏加载
 * 严格遵循全栈项目统一约定规范
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // 解析查询参数
  const page = Number(searchParams.page) || 1;
  const limit = Number(searchParams.limit) || paginationConfig.defaultPageSize;
  const search = (searchParams.search as string) || '';
  const categoryId = (searchParams.categoryId as string) || '';
  const status = (searchParams.status as string) || 'active';
  const sortBy = (searchParams.sortBy as string) || 'createdAt';
  const sortOrder = (searchParams.sortOrder as string) || 'desc';
  const includeInventory =
    searchParams.includeInventory === 'true' ||
    productConfig.defaultIncludeInventory;
  const includeStatistics =
    searchParams.includeStatistics === 'true' ||
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
