import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';

import { CountsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '盘点单 - 库存管理',
  description: '管理盘点单，跟踪录入进度',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 库存盘点列表页面（Server Component）
 */
export default async function CountsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
    countType?: string;
    location?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  // 获取用户会话
  const session = await getServerSession(authOptions);

  // 检查权限
  if (!session?.user || !can(session.user, 'inventory:view')) {
    redirect('/dashboard');
  }

  const hasManagePermission = can(session.user, 'inventory:manage');

  // 解析查询参数
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const pageSize = parseInt(params.pageSize || '20', 10);

  const initialParams = {
    page,
    pageSize,
    search: params.search,
    status: params.status,
    countType: params.countType,
    location: params.location,
    categoryId: params.categoryId,
    startDate: params.startDate,
    endDate: params.endDate,
    sortBy: params.sortBy || 'planDate',
    sortOrder: (params.sortOrder as 'asc' | 'desc') || 'desc',
  };

  return (
    <CountsPageClient
      initialParams={initialParams}
      hasManagePermission={hasManagePermission}
    />
  );
}
