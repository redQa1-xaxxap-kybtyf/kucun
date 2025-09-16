import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';

/**
 * 根页面组件
 * 根据用户认证状态重定向到相应页面
 * 严格遵循App Router优先思维
 */
export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    // 已认证用户重定向到仪表盘
    redirect('/dashboard');
  } else {
    // 未认证用户重定向到登录页
    redirect('/auth/signin');
  }
}
