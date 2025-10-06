import { ERPProductList } from '@/components/products/erp-product-list';
import { getProductsForServer } from '@/lib/api/products-server';
import { paginationConfig, productConfig } from '@/lib/env';

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

  // 服务器端直接获取初始数据，避免 HTTP 跳转
  const initialData = await getProductsForServer({
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
      </div>
    </div>
  );
}
