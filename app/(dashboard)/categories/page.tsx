import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import { CategoryPageWrapper } from '@/components/categories/category-page-wrapper';
import {
  categoryQueryKeys,
  type Category,
  type CategoryQueryParams,
} from '@/lib/api/categories';
import { getCategoriesServer } from '@/lib/api/categories-server';
import { requireServerAuth } from '@/lib/auth/context';
import { requirePermission } from '@/lib/auth/permissions';

/**
 * 分类管理页面
 *
 * ✅ Next.js 15 最佳实践：
 * - Server Component 架构
 * - Route Segment Config 缓存控制
 * - 直接服务端数据获取
 * - 类型安全的 searchParams
 */

// ============================================
// Route Segment Config
// ============================================

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireServerAuth();
  try {
    requirePermission(user, 'categories:view');
  } catch {
    redirect('/auth/error?error=AccessDenied');
  }

  // 解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 10;
  const search = (params.search as string) || '';
  const status = params.status as 'active' | 'inactive' | undefined;
  const sortBy =
    (params.sortBy as
      | 'code'
      | 'name'
      | 'sortOrder'
      | 'createdAt'
      | 'updatedAt') || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  const normalizedSearch =
    typeof search === 'string' && search.trim().length > 0
      ? search.trim()
      : undefined;

  const baseQueryParams: Omit<CategoryQueryParams, 'parentId'> & {
    parentId?: string;
  } = {
    page,
    limit,
    search: normalizedSearch,
    status,
    sortBy,
    sortOrder,
  };

  const queryParams: CategoryQueryParams = {
    ...baseQueryParams,
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  const initialData = await getCategoriesServer({
    ...queryParams,
    parentId: queryParams.parentId ?? undefined,
    search: normalizedSearch,
  });

  const serializedData: {
    data: Category[];
    pagination: typeof initialData.pagination;
  } = {
    data: initialData.data,
    pagination: initialData.pagination,
  };

  const queryKey = categoryQueryKeys.list(baseQueryParams);

  queryClient.setQueryData(queryKey, serializedData);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CategoryPageWrapper initialParams={queryParams} />
    </HydrationBoundary>
  );
}
