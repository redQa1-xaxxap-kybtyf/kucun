import { CategoryPageWrapper } from '@/components/categories/category-page-wrapper';
import { getCategoriesServer } from '@/lib/api/categories-server';

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

  // 直接获取初始数据（统一模式：避免 HydrationBoundary）
  const initialData = await getCategoriesServer({
    page,
    limit,
    search,
    status,
    sortBy,
    sortOrder,
  });

  const serializedData = {
    data: initialData.data.map(category => ({
      ...category,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    })),
    pagination: initialData.pagination,
  };

  return (
    <CategoryPageWrapper
      initialData={serializedData}
      initialParams={{ page, limit, search, status, sortBy, sortOrder }}
    />
  );
}
