import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import { getInventoryCountById } from '@/lib/services/inventory-count/queries';

import { EditCountPageClient } from './page-client';

export const metadata: Metadata = {
  title: '编辑盘点计划 - 库存管理',
  description: '编辑库存盘点计划信息',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

interface EditCountPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 编辑盘点计划页面（Server Component）
 */
export default async function EditCountPage({ params }: EditCountPageProps) {
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

  // 只能编辑草稿状态的盘点计划
  if (count.status !== 'draft') {
    redirect(`/inventory/counts/${id}`);
  }

  return <EditCountPageClient countId={id} initialData={count} />;
}
