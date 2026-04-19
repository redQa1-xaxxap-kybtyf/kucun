import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';

import { NewCountPageClient } from './page-client';

export const metadata: Metadata = {
  title: '新建盘点单 - 库存管理',
  description: '填写基本信息和盘点范围',
};

/**
 * 创建盘点计划页面（Server Component）
 */
export default async function NewCountPage() {
  // 获取用户会话
  const session = await getServerSession(authOptions);

  // 检查权限
  if (!session?.user || !can(session.user, 'inventory:manage')) {
    redirect('/inventory/counts');
  }

  return <NewCountPageClient />;
}
