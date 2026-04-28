'use client';

import dynamic from 'next/dynamic';
import type { Session } from 'next-auth';
import * as React from 'react';

import type { NavigationItem, SidebarState } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

import { Breadcrumb, CompactBreadcrumb } from './Breadcrumb';
import { BreadcrumbProvider } from './BreadcrumbContext';
import { Header } from './Header';
import {
  bottomNavigationItems,
  navigationItems,
} from './sidebar-navigation-config';
import { SidebarClient } from './SidebarClient';

const MobileNav = dynamic(
  () => import('./MobileNav').then(mod => mod.MobileNav),
  { ssr: false }
);

const MOBILE_BREAKPOINT = 768;
const COMPACT_DESKTOP_BREAKPOINT = 1440;

interface DashboardLayoutClientProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 服务端传递的 session 数据 */
  session: Session;
  /** 服务端过滤后的可访问导航项 ID */
  accessibleNavItemIds: string[];
  /** 服务端过滤后的可访问底部导航项 ID */
  accessibleBottomNavItemIds: string[];
  /** 服务端传递的账套模式 */
  systemMode: 'trial' | 'production';
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示侧边栏 */
  showSidebar?: boolean;
  /** 是否显示顶部导航栏 */
  showHeader?: boolean;
  /** 是否显示面包屑 */
  showBreadcrumb?: boolean;
}

/**
 * 根据 ID 列表从完整导航配置中筛选导航项
 */
function getNavItemsByIds(
  ids: string[],
  allItems: NavigationItem[]
): NavigationItem[] {
  const result: NavigationItem[] = [];

  for (const item of allItems) {
    const childItems =
      item.children && item.children.length > 0
        ? getNavItemsByIds(ids, item.children)
        : undefined;

    const shouldIncludeSelf = ids.includes(item.id);
    const shouldIncludeChildren = Boolean(childItems && childItems.length > 0);

    if (!shouldIncludeSelf && !shouldIncludeChildren) {
      continue;
    }

    result.push({
      ...item,
      children: shouldIncludeChildren ? childItems : undefined,
    });
  }

  return result;
}

/**
 * 仪表盘客户端布局组件
 * 优化版本：权限过滤在服务端完成，客户端只负责交互和响应式
 *
 * 性能优化点:
 * 1. 权限过滤逻辑移至服务端，避免客户端重复计算
 * 2. 批量状态更新，避免多次渲染
 * 3. 使用 useCallback 优化回调函数
 * 4. 减少不必要的 useMemo 依赖
 * 5. ✅ 修复: 只传递导航项 ID,在客户端重新组装,避免传递 React 组件
 */
export function DashboardLayoutClient({
  children,
  session,
  accessibleNavItemIds,
  accessibleBottomNavItemIds,
  systemMode,
  className,
  showSidebar = true,
  showHeader = true,
  showBreadcrumb = true,
}: DashboardLayoutClientProps) {
  // ✅ 在客户端根据 ID 重新组装导航项(包含 icon)
  const accessibleNavItems = React.useMemo(
    () => getNavItemsByIds(accessibleNavItemIds, navigationItems),
    [accessibleNavItemIds]
  );

  const accessibleBottomNavItems = React.useMemo(
    () => getNavItemsByIds(accessibleBottomNavItemIds, bottomNavigationItems),
    [accessibleBottomNavItemIds]
  );

  // 侧边栏状态管理（优化：批量更新状态，避免多次渲染）
  const [sidebarSettings, setSidebarSettings] = React.useState(() => ({
    isOpen: showSidebar,
    isCollapsed: false,
    mobileNavOpen: false,
  }));

  // 使用 useCallback 优化状态更新函数，避免每次渲染都创建新函数
  const toggle = React.useCallback(() => {
    setSidebarSettings(prev => ({
      ...prev,
      isCollapsed: !prev.isCollapsed,
    }));
  }, []);

  const setOpen = React.useCallback((open: boolean) => {
    setSidebarSettings(prev => ({
      ...prev,
      isOpen: open,
    }));
  }, []);

  const setCollapsed = React.useCallback((collapsed: boolean) => {
    setSidebarSettings(prev => ({
      ...prev,
      isCollapsed: collapsed,
    }));
  }, []);

  const setMobileNavOpen = React.useCallback((open: boolean) => {
    setSidebarSettings(prev => ({
      ...prev,
      mobileNavOpen: open,
    }));
  }, []);

  // 组合 sidebarState 对象（使用 useMemo 避免每次渲染都创建新对象）
  const sidebarState = React.useMemo<SidebarState>(
    () => ({
      isOpen: sidebarSettings.isOpen,
      isCollapsed: sidebarSettings.isCollapsed,
      toggle,
      setOpen,
      setCollapsed,
    }),
    [
      sidebarSettings.isOpen,
      sidebarSettings.isCollapsed,
      toggle,
      setOpen,
      setCollapsed,
    ]
  );

  // 触摸手势状态
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!showSidebar) {
      setSidebarSettings(prev =>
        prev.isOpen || prev.mobileNavOpen
          ? {
              ...prev,
              isOpen: false,
              mobileNavOpen: false,
            }
          : prev
      );
      return;
    }

    setSidebarSettings(prev =>
      prev.isOpen ? prev : { ...prev, isOpen: true }
    );
  }, [showSidebar]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      const width = window.innerWidth;
      const shouldUseCompactSidebar =
        width >= MOBILE_BREAKPOINT && width < COMPACT_DESKTOP_BREAKPOINT;

      setSidebarSettings(prev => {
        const nextMobileNavOpen =
          width >= MOBILE_BREAKPOINT ? false : prev.mobileNavOpen;
        const nextCollapsed = showSidebar
          ? shouldUseCompactSidebar
          : prev.isCollapsed;

        if (
          prev.mobileNavOpen === nextMobileNavOpen &&
          prev.isCollapsed === nextCollapsed
        ) {
          return prev;
        }

        return {
          ...prev,
          mobileNavOpen: nextMobileNavOpen,
          isCollapsed: nextCollapsed,
        };
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showSidebar]);

  // 手势处理（使用 useCallback 优化）
  const minSwipeDistance = 50;

  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const onTouchEnd = React.useCallback(() => {
    if (!touchStart || !touchEnd || typeof window === 'undefined') {
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    const isMobileViewport = window.innerWidth < MOBILE_BREAKPOINT;

    if (isMobileViewport) {
      // 右滑打开菜单，左滑关闭菜单
      if (isRightSwipe && !sidebarSettings.mobileNavOpen) {
        setMobileNavOpen(true);
      } else if (isLeftSwipe && sidebarSettings.mobileNavOpen) {
        setMobileNavOpen(false);
      }
    }
  }, [touchStart, touchEnd, sidebarSettings.mobileNavOpen, setMobileNavOpen]);

  return (
    <BreadcrumbProvider>
      {/* 跳过导航链接 - WCAG 2.4.1 合规 */}
      <a
        href="#main-content"
        className="focus:bg-background focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-offset-2"
      >
        跳过导航，直达主要内容
      </a>
      <div className={cn('bg-background flex h-screen flex-col', className)}>
        {/* 顶部导航栏 - 固定高度 */}
        {showHeader && (
          <Header
            showMobileMenuButton={showSidebar}
            onMobileMenuClick={() => setMobileNavOpen(true)}
            user={session.user} // 传递用户信息，避免客户端重复请求
            systemMode={systemMode}
          />
        )}

        <div className="flex flex-1">
          {/* 桌面端侧边栏 - 固定位置，独立滚动 */}
          {showSidebar && sidebarSettings.isOpen && (
            <SidebarClient
              state={sidebarState}
              className="hidden md:flex"
              accessibleNavItems={accessibleNavItems}
              accessibleBottomNavItems={accessibleBottomNavItems}
            />
          )}

          {/* 移动端抽屉导航 */}
          {showSidebar && (
            <MobileNav
              open={sidebarSettings.mobileNavOpen}
              onOpenChange={setMobileNavOpen}
            />
          )}

          {/* 主内容区域 - 允许滚动 */}
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              'flex flex-1 flex-col overflow-y-auto transition-all duration-200 focus:outline-none',
              showSidebar &&
                sidebarSettings.isOpen &&
                (sidebarSettings.isCollapsed ? 'md:ml-16' : 'md:ml-64')
            )}
            onTouchStart={showSidebar ? onTouchStart : undefined}
            onTouchMove={showSidebar ? onTouchMove : undefined}
            onTouchEnd={showSidebar ? onTouchEnd : undefined}
          >
            {/* 固定的顶部区域：面包屑和页面标题 */}
            {showBreadcrumb && (
              <div
                className={cn(
                  'sticky top-0 z-40 flex-shrink-0 border-b border-slate-200 bg-white transition-colors',
                  'px-4 py-3 md:px-8'
                )}
              >
                <div className="md:hidden">
                  <CompactBreadcrumb className="text-muted-foreground text-xs font-medium" />
                </div>
                <div className="hidden md:block">
                  <Breadcrumb className="text-muted-foreground text-xs font-medium" />
                </div>
              </div>
            )}

            {/* 主要内容区域 */}
            <div className="flex flex-1 flex-col">{children}</div>
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
