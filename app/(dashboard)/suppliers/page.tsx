import type { Metadata } from 'next';

import { SuppliersPageClient } from '@/components/suppliers/suppliers-page-client';
import { paginationConfig } from '@/lib/env';
import { getSuppliers } from '@/lib/services/supplier-service';

export const metadata: Metadata = {
  title: '供应商管理',
  description: '管理供应商信息',
};

/**
 * 供应商管理页面
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
export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const status =
    (params.status as 'active' | 'inactive' | undefined) || undefined;
  const sortBy = (params.sortBy as string) || 'createdAt';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  // 服务器端获取初始数据
  const initialData = await getSuppliers({
    page,
    limit,
    search,
    status: status === undefined ? undefined : status,
    sortBy,
    sortOrder,
  });

  return (
    <SuppliersPageClient
      initialData={initialData}
      initialParams={{ page, limit, search, status, sortBy, sortOrder }}
    />
  );
}
