import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';

import { categoryQueryKeys } from '@/lib/api/categories';
import { getCategoriesServer } from '@/lib/api/categories-server';
import { productQueryKeys } from '@/lib/api/products';
import { getProductsForServer } from '@/lib/api/products-server';
import { paginationConfig, productConfig } from '@/lib/env';
import type { PaginatedResponse } from '@/lib/types/api';
import type { Product } from '@/lib/types/product';

import { ProductsPageClient } from './page-client';

/**
 * 产品管理页面 - 使用服务器组件优化首屏加载
 * 严格遵循全栈项目统一约定规范
 * 参考客户管理页面架构，使用URL参数驱动数据获取
 *
 * ✅ Next.js 15 最佳实践：
 * - Route Segment Config 配置
 * - Server Component 数据获取
 * - 并行数据预取
 */

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
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
  const status = (params.status as 'active' | 'inactive') || undefined;
  const sortBy = (params.sortBy as string) || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';
  const includeInventory =
    params.includeInventory === 'true' || productConfig.defaultIncludeInventory;
  const includeStatistics =
    params.includeStatistics === 'true' ||
    productConfig.defaultIncludeStatistics;

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  // 并行获取产品数据和分类数据
  const [initialData, categoriesData] = await Promise.all([
    getProductsForServer({
      page,
      limit,
      search,
      categoryId,
      status,
      sortBy,
      sortOrder,
      includeInventory,
      includeStatistics,
    }),
    getCategoriesServer({
      status: 'active',
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc',
    }),
  ]);

  const normalizedData: PaginatedResponse<Product> = initialData
    ? {
        data: initialData.data.map<Product>(product => ({
          ...product,
          createdAt:
            product.createdAt instanceof Date
              ? product.createdAt.toISOString()
              : product.createdAt,
          updatedAt:
            product.updatedAt instanceof Date
              ? product.updatedAt.toISOString()
              : product.updatedAt,
        })),
        pagination: initialData.pagination,
      }
    : {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };

  queryClient.setQueryData(
    productQueryKeys.list({
      page,
      limit,
      search,
      categoryId,
      status,
      sortBy,
      sortOrder,
    }),
    normalizedData
  );

  queryClient.setQueryData(
    categoryQueryKeys.list({
      status: 'active',
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc',
    }),
    categoriesData
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductsPageClient
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
    </HydrationBoundary>
  );
}
