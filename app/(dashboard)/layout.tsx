import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import * as React from 'react';

import { DashboardLayoutClient } from '@/components/common/DashboardLayoutClient';
import { authOptions } from '@/lib/auth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * 仪表盘路由组布局 - 服务端组件
 * 在服务端进行认证检查，提供最佳性能
 * 严格遵循 Next.js 15 App Router 最佳实践
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  // 在服务端获取 session
  const session = await getServerSession(authOptions);

  // 如果未认证，重定向到登录页
  if (!session) {
    redirect('/auth/signin');
  }

  // 传递 session 数据到客户端组件
  return (
    <DashboardLayoutClient session={session}>{children}</DashboardLayoutClient>
  );
}

/**
 * 路由组元数据
 */
export const metadata = {
  title: {
    template: '%s - 库存管理工具',
    default: '库存管理工具',
  },
  description: '专业的库存管理解决方案',
};
