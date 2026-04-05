import * as React from 'react';

import { safeAuth } from '@/lib/auth';
import { getAccessibleNavItems } from '@/lib/auth/permissions';
import type { NavigationItem, SidebarState } from '@/lib/types/layout';
import type { UserRole } from '@/lib/types/user';

import {
  bottomNavigationItems,
  navigationItems,
} from './sidebar-navigation-config';
import { SidebarClient } from './SidebarClient';

interface SidebarServerProps {
  /** 侧边栏状态 */
  state: SidebarState;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * Sidebar Server Component
 * 在服务器端获取 session 和过滤导航项
 * 避免客户端等待 NextAuth Session Ready
 */
export async function SidebarServer({ state, className }: SidebarServerProps) {
  // 在服务器端获取 session
  const session = await safeAuth('sidebar-server');
  const userRole = session?.user?.role as UserRole | undefined;

  // 在服务器端过滤导航项(基于权限)
  const accessibleNavItems = userRole
    ? (getAccessibleNavItems(
        navigationItems as Array<{ requiredRoles?: UserRole[] }>,
        userRole
      ) as NavigationItem[])
    : [];

  const accessibleBottomNavItems = userRole
    ? (getAccessibleNavItems(
        bottomNavigationItems as Array<{ requiredRoles?: UserRole[] }>,
        userRole
      ) as NavigationItem[])
    : [];

  // 传递过滤后的导航项到客户端组件
  return (
    <SidebarClient
      state={state}
      className={className}
      accessibleNavItems={accessibleNavItems}
      accessibleBottomNavItems={accessibleBottomNavItems}
    />
  );
}
