/**
 * 打印设计器 - Server Actions 权限工具
 */

'use server';

import { auth } from '@/lib/auth';

export type AuthUser = NonNullable<Awaited<ReturnType<typeof auth>>>['user'];

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('未授权访问');
  }
  return user;
}

export async function requireAdminUser(): Promise<AuthUser> {
  const user = await requireAuthUser();
  if (user.role !== 'admin') {
    throw new Error('需要管理员权限');
  }
  return user;
}
