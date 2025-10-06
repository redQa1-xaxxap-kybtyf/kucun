import { CategoryPageWrapper } from '@/components/categories/category-page-wrapper';
import { getCategoriesServer } from '@/lib/api/categories-server';

/**
 * 分类管理页面
 * 严格遵循全栈项目统一约定规范
 * 服务端组件 - 优先使用 App Router SSR，统一使用直接数据获取模式
 */
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
  const sortBy = (params.sortBy as string) || 'createdAt';
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

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <CategoryPageWrapper
          initialData={initialData}
          initialParams={{ page, limit, search, status, sortBy, sortOrder }}
        />
      </div>
    </div>
  );
}
