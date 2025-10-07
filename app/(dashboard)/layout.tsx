import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import * as React from 'react';

import { DashboardLayoutClient } from '@/components/common/DashboardLayoutClient';
import {
  bottomNavigationItems,
  navigationItems,
} from '@/components/common/sidebar-navigation-config';
import { authOptions } from '@/lib/auth';
import type { UserRole } from '@/lib/types/user';
import { getAccessibleNavItems } from '@/lib/utils/permissions';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * 仪表盘路由组布局 - 服务端组件
 * 优化版本：在服务端完成认证检查和权限过滤
 *
 * 性能优化点:
 * 1. 服务端统一进行权限过滤，避免客户端重复计算
 * 2. 减少客户端 JavaScript 包大小
 * 3. 提升首屏渲染速度
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

  // 在服务端根据用户角色过滤导航项
  const userRole = session?.user?.role as UserRole | undefined;
  const accessibleNavItems = userRole
    ? getAccessibleNavItems(
        navigationItems as Array<{ requiredRoles?: UserRole[] }>,
        userRole
      )
    : [];

  const accessibleBottomNavItems = userRole
    ? getAccessibleNavItems(
        bottomNavigationItems as Array<{ requiredRoles?: UserRole[] }>,
        userRole
      )
    : [];

  // ✅ 只传递导航项的 ID,避免传递 React 组件(icon)
  const accessibleNavItemIds = accessibleNavItems.map(item => item.id);
  const accessibleBottomNavItemIds = accessibleBottomNavItems.map(
    item => item.id
  );

  // 传递 session 和过滤后的导航项 ID 到客户端组件
  return (
    <DashboardLayoutClient
      session={session}
      accessibleNavItemIds={accessibleNavItemIds}
      accessibleBottomNavItemIds={accessibleBottomNavItemIds}
    >
      {children}
    </DashboardLayoutClient>
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
