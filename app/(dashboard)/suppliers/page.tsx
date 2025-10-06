import { Suspense } from 'react';
import type { Metadata } from 'next';

import { SupplierListSkeleton } from '@/components/suppliers/supplier-list-skeleton';
import { SuppliersPageClient } from '@/components/suppliers/suppliers-page-client';
import { getSuppliers } from '@/lib/services/supplier-service';
import { paginationConfig } from '@/lib/env';

export const metadata: Metadata = {
  title: '供应商管理',
  description: '管理供应商信息',
};

/**
 * 供应商管理页面 - Server Component
 * 负责数据获取和 SEO 优化
 * 严格遵循前端架构规范：三级组件架构
 */
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
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <Suspense fallback={<SupplierListSkeleton />}>
          <SuppliersPageClient
            initialData={initialData}
            initialParams={{ page, limit, search, status, sortBy, sortOrder }}
          />
        </Suspense>
      </div>
    </div>
  );
}
