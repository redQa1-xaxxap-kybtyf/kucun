import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';

import { CountStatisticsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '盘点统计 - 库存管理',
  description: '查看库存盘点统计数据和分析',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 盘点统计页面（Server Component）
 */
export default async function CountStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    status?: string;
  }>;
}) {
  // 获取用户会话
  const session = await getServerSession(authOptions);

  // 检查权限
  if (!session?.user || !can(session.user, 'inventory:view')) {
    redirect('/dashboard');
  }

  // 解析查询参数
  const params = await searchParams;

  // 默认日期范围：最近30天
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const initialParams = {
    startDate: params.startDate || startDate.toISOString().split('T')[0],
    endDate: params.endDate || endDate.toISOString().split('T')[0],
    status: params.status,
  };

  return <CountStatisticsPageClient initialParams={initialParams} />;
}
