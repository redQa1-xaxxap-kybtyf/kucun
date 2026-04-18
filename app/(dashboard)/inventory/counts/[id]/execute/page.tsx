import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import { getInventoryCountById } from '@/lib/services/inventory-count/queries';

import { ExecuteCountPageClient } from './page-client';

export const metadata: Metadata = {
  title: '录入盘点结果 - 库存管理',
  description: '录入盘点结果并提交盘点单',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

interface ExecuteCountPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 执行盘点页面（Server Component）
 */
export default async function ExecuteCountPage({
  params,
}: ExecuteCountPageProps) {
  // 获取用户会话
  const session = await getServerSession(authOptions);

  // 检查权限
  if (!session?.user || !can(session.user, 'inventory:manage')) {
    redirect('/inventory/counts');
  }

  // 解析参数
  const { id } = await params;

  // 获取盘点计划详情
  const count = await getInventoryCountById(id);

  if (!count) {
    notFound();
  }

  // 只能执行进行中状态的盘点计划
  if (count.status !== 'in_progress') {
    redirect(`/inventory/counts/${id}`);
  }

  const hasFinancePermission = can(session.user, 'finance:view');

  return (
    <ExecuteCountPageClient
      countId={id}
      initialData={count}
      hasFinancePermission={hasFinancePermission}
    />
  );
}
