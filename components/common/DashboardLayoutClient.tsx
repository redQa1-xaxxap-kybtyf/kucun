'use client';

import type { Session } from 'next-auth';
import dynamic from 'next/dynamic';
import * as React from 'react';

import { useMediaQuery } from '@/hooks/use-media-query';
import type {
  LayoutConfig,
  NavigationItem,
  SidebarState,
} from '@/lib/types/layout';
import { cn } from '@/lib/utils';

import { Breadcrumb } from './Breadcrumb';
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
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');

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
    isOpen: !isMobile,
    isCollapsed: isTablet,
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

  // 响应式布局调整（优化：批量更新状态，避免多次渲染）
  React.useEffect(() => {
    setSidebarSettings(prev => {
      // 计算新状态
      const newState = isMobile
        ? { isOpen: false, isCollapsed: false, mobileNavOpen: false }
        : isTablet
          ? { isOpen: true, isCollapsed: true, mobileNavOpen: false }
          : { isOpen: true, isCollapsed: false, mobileNavOpen: false };

      // 只有状态真正变化时才更新
      if (
        prev.isOpen === newState.isOpen &&
        prev.isCollapsed === newState.isCollapsed &&
        prev.mobileNavOpen === newState.mobileNavOpen
      ) {
        return prev;
      }

      return newState;
    });
  }, [isMobile, isTablet]); // ✅ 只依赖媒体查询结果

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
    if (!touchStart || !touchEnd) {
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isMobile) {
      // 右滑打开菜单，左滑关闭菜单
      if (isRightSwipe && !sidebarSettings.mobileNavOpen) {
        setMobileNavOpen(true);
      } else if (isLeftSwipe && sidebarSettings.mobileNavOpen) {
        setMobileNavOpen(false);
      }
    }
  }, [
    touchStart,
    touchEnd,
    isMobile,
    sidebarSettings.mobileNavOpen,
    setMobileNavOpen,
  ]);

  const _layoutConfig: LayoutConfig = {
    showSidebar,
    showHeader,
    sidebarCollapsed: sidebarSettings.isCollapsed,
    isMobile,
    theme: 'light', // 后续可以从用户设置中获取
  };

  return (
    <BreadcrumbProvider>
      {/* 跳过导航链接 - WCAG 2.4.1 合规 */}
      <a
        href="#main-content"
        className="focus:bg-background focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-offset-2"
      >
        跳过导航，直达主要内容
      </a>
      <div className={cn('bg-background flex h-screen flex-col', className)}>
        {/* 顶部导航栏 - 固定高度 */}
        {showHeader && (
          <Header
            showMobileMenuButton={isMobile}
            onMobileMenuClick={() => setMobileNavOpen(true)}
            user={session.user} // 传递用户信息，避免客户端重复请求
            systemMode={systemMode}
          />
        )}

        <div className="flex flex-1">
          {/* 桌面端侧边栏 - 固定位置，独立滚动 */}
          {showSidebar && !isMobile && sidebarSettings.isOpen && (
            <SidebarClient
              state={sidebarState}
              accessibleNavItems={accessibleNavItems}
              accessibleBottomNavItems={accessibleBottomNavItems}
            />
          )}

          {/* 移动端抽屉导航 */}
          {isMobile && (
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
              'flex flex-1 flex-col overflow-y-auto transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none',
              !isMobile &&
                sidebarSettings.isOpen &&
                (sidebarSettings.isCollapsed ? 'ml-20' : 'ml-72')
            )}
            onTouchStart={isMobile ? onTouchStart : undefined}
            onTouchMove={isMobile ? onTouchMove : undefined}
            onTouchEnd={isMobile ? onTouchEnd : undefined}
          >
            {/* 固定的顶部区域：面包屑和页面标题 */}
            {showBreadcrumb && (
              <div
                className={cn(
                  'sticky top-0 z-40 flex-shrink-0 border-b border-slate-50 bg-white/40 backdrop-blur-md transition-all',
                  isMobile ? 'px-4 py-3' : 'px-8 py-3'
                )}
              >
                <Breadcrumb className="text-xs font-black tracking-widest text-slate-500 uppercase" />
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
