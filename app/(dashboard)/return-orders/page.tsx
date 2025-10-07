import { ReturnOrdersPageClient } from './page-client';

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }>;
}

/**
 * 退货订单管理页面
 *
 * ✅ Next.js 15 最佳实践：
 * - Server Component 架构
 * - Route Segment Config 缓存控制
 * - 类型安全的 searchParams
 * - 客户端状态管理分离
 */

// ============================================
// Route Segment Config
// ============================================

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
export default async function ReturnOrdersPage({ searchParams }: PageProps) {
  // 解析查询参数
  const params = await searchParams;
  const initialParams = {
    page: params?.page ? parseInt(params.page, 10) : 1,
    limit: params?.limit ? parseInt(params.limit, 10) : 20,
    search: params?.search || '',
    status: params?.status as string | undefined,
    sortBy: params?.sortBy || 'createdAt',
    sortOrder: (params?.sortOrder as 'asc' | 'desc') || 'desc',
  };

  return <ReturnOrdersPageClient initialParams={initialParams} />;
}
