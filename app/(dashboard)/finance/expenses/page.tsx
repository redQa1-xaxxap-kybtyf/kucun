import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';

import { ExpensesPageClient } from './page-client';

export const metadata: Metadata = {
  title: '费用记录 - 财务管理',
  description: '管理各类费用记录，跟踪费用支出情况',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 费用记录列表页面（Server Component）
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    expenseType?: string;
    startDate?: string;
    endDate?: string;
    relatedType?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  // 获取用户会话
  const session = await getServerSession(authOptions);

  // 检查权限
  if (!session?.user || !can(session.user, 'finance:view')) {
    redirect('/dashboard');
  }

  // 解析查询参数
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const pageSize = parseInt(params.pageSize || '20', 10);

  const initialParams = {
    page,
    pageSize,
    expenseType: params.expenseType,
    startDate: params.startDate,
    endDate: params.endDate,
    relatedType: params.relatedType,
    sortBy: params.sortBy || 'expenseDate',
    sortOrder: (params.sortOrder as 'asc' | 'desc') || 'desc',
  };

  return <ExpensesPageClient initialParams={initialParams} />;
}
