'use client';

import type { Session } from 'next-auth';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { useMediaQuery } from '@/hooks/use-media-query';
import type { LayoutConfig, SidebarState } from '@/lib/types/layout';
import type { UserRole } from '@/lib/types/user';
import { cn } from '@/lib/utils';
import { getAccessibleNavItems } from '@/lib/utils/permissions';

import { Breadcrumb } from './Breadcrumb';
import { GlobalSearch } from './GlobalSearch/index';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { SidebarClient } from './SidebarClient';
import {
  bottomNavigationItems,
  navigationItems,
} from './sidebar-navigation-config';

interface DashboardLayoutClientProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 服务端传递的 session 数据 */
  session: Session;
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示侧边栏 */
  showSidebar?: boolean;
  /** 是否显示顶部导航栏 */
  showHeader?: boolean;
  /** 是否显示面包屑 */
  showBreadcrumb?: boolean;
  /** 是否启用全局搜索 */
  enableGlobalSearch?: boolean;
}

/**
 * 仪表盘客户端布局组件
 * 接收服务端传递的 session 数据，避免客户端重复请求
 * 严格遵循 Next.js 15 App Router 最佳实践
 */
export function DashboardLayoutClient({
  children,
  session,
  className,
  showSidebar = true,
  showHeader = true,
  showBreadcrumb = true,
  enableGlobalSearch = true,
}: DashboardLayoutClientProps) {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');

  // 全局搜索状态
  const [globalSearchOpen, setGlobalSearchOpen] = React.useState(false);

  // 根据用户角色过滤导航项（使用服务端传递的 session）
  const userRole = session?.user?.role as UserRole | undefined;
  const accessibleNavItems = React.useMemo(
    () =>
      userRole
        ? getAccessibleNavItems(
            navigationItems as Array<{ requiredRoles?: UserRole[] }>,
            userRole
          )
        : [],
    [userRole]
  );

  const accessibleBottomNavItems = React.useMemo(
    () =>
      userRole
        ? getAccessibleNavItems(
            bottomNavigationItems as Array<{ requiredRoles?: UserRole[] }>,
            userRole
          )
        : [],
    [userRole]
  );

  // 侧边栏状态管理（优化：避免状态更新循环）
  const [isOpen, setIsOpen] = React.useState<boolean>(() => !isMobile);
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(() => isTablet);

  // 使用 useCallback 优化状态更新函数，避免每次渲染都创建新函数
  const toggle = React.useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const setOpenCallback = React.useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const setCollapsedCallback = React.useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  // 组合 sidebarState 对象（使用 useMemo 避免每次渲染都创建新对象）
  const sidebarState = React.useMemo<SidebarState>(
    () => ({
      isOpen,
      isCollapsed,
      toggle,
      setOpen: setOpenCallback,
      setCollapsed: setCollapsedCallback,
    }),
    [isOpen, isCollapsed, toggle, setOpenCallback, setCollapsedCallback]
  );

  // 移动端导航状态
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // 触摸手势状态
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  // 响应式布局调整（优化：避免依赖循环，使用单次状态更新）
  React.useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
      setIsCollapsed(false);
      setMobileNavOpen(false);
    } else if (isTablet) {
      setIsOpen(true);
      setIsCollapsed(true);
    } else {
      setIsOpen(true);
      setIsCollapsed(false);
    }
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
      if (isRightSwipe && !mobileNavOpen) {
        setMobileNavOpen(true);
      } else if (isLeftSwipe && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    }
  }, [touchStart, touchEnd, isMobile, mobileNavOpen]);

  // 全局键盘快捷键
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K 打开全局搜索
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (enableGlobalSearch) {
          setGlobalSearchOpen(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableGlobalSearch]);

  // 处理搜索（使用 useCallback 避免不必要的重新创建）
  const handleSearch = React.useCallback((query: string) => {
    console.log('搜索:', query);
    // 这里可以添加搜索逻辑或导航到搜索结果页面
  }, []);

  const _layoutConfig: LayoutConfig = {
    showSidebar,
    showHeader,
    sidebarCollapsed: isCollapsed,
    isMobile,
    theme: 'light', // 后续可以从用户设置中获取
  };

  return (
    <>
      <div className={cn('bg-background min-h-screen', className)}>
        {/* 顶部导航栏 */}
        {showHeader && (
          <Header
            showMobileMenuButton={isMobile}
            onMobileMenuClick={() => setMobileNavOpen(true)}
            user={session.user} // 传递用户信息，避免客户端重复请求
          />
        )}

        <div className="flex flex-1">
          {/* 桌面端侧边栏 */}
          {showSidebar && !isMobile && isOpen && (
            <SidebarClient
              state={sidebarState}
              accessibleNavItems={accessibleNavItems}
              accessibleBottomNavItems={accessibleBottomNavItems}
            />
          )}

          {/* 移动端抽屉导航 */}
          {isMobile && (
            <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
          )}

          {/* 主内容区域 */}
          <main
            className={cn(
              'flex-1 overflow-auto',
              // 根据侧边栏状态调整内容区域
              showSidebar &&
                !isMobile &&
                isOpen &&
                (isCollapsed ? 'ml-0' : 'ml-0'),
              // 内边距调整
              isMobile ? 'p-4' : 'p-6',
              // 顶部间距调整（如果有header）
              showHeader && 'pt-6'
            )}
            onTouchStart={isMobile ? onTouchStart : undefined}
            onTouchMove={isMobile ? onTouchMove : undefined}
            onTouchEnd={isMobile ? onTouchEnd : undefined}
          >
            {/* 页面标题和面包屑 */}
            {showBreadcrumb && (
              <div className="mb-6 space-y-4">
                <Breadcrumb />
              </div>
            )}

            {/* 主要内容 */}
            {children}
          </main>
        </div>
      </div>

      {/* 全局搜索对话框 */}
      {enableGlobalSearch && (
        <GlobalSearch
          open={globalSearchOpen}
          onOpenChange={setGlobalSearchOpen}
          onSearch={handleSearch}
        />
      )}
    </>
  );
}
