import { ReturnOrderEditPageClient } from './page-client';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 退货订单编辑页
 *
 * ✅ Next.js 15 最佳实践：
 * - Server Component 架构
 * - 面包屑自动显示（通过 DashboardLayoutClient）
 * - 类型安全的 params
 */

// ============================================
// Route Segment Config
// ============================================

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function ReturnOrderEditPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <ReturnOrderEditPageClient id={id} />
      </div>
    </div>
  );
}
