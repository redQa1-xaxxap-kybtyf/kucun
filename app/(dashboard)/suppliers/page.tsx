import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
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
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">供应商管理</h1>
          <p className="text-muted-foreground">管理供应商信息</p>
        </div>
        <Button asChild>
          <Link href="/suppliers/create">
            <Plus className="mr-2 h-4 w-4" />
            新建供应商
          </Link>
        </Button>
      </div>

      {/* 客户端交互组件 */}
      <Suspense fallback={<SupplierListSkeleton />}>
        <SuppliersPageClient
          initialData={initialData}
          initialParams={{ page, limit, search, status, sortBy, sortOrder }}
        />
      </Suspense>
    </div>
  );
}
