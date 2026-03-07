import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';

import UsersSettingsPageClient from './page-client';

/**
 * 用户管理设置页面（Server）
 * - 在 Server 侧读取 session，避免引入 next-auth 客户端依赖
 * - 将权限与当前用户信息下发给 Client 组件渲染
 */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function UsersSettingsPage() {
  const session = await getServerSession(authOptions);

  return (
    <UsersSettingsPageClient
      currentUserId={session?.user?.id ?? ''}
      isAdmin={session?.user?.role === 'admin'}
    />
  );
}
