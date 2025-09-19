'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { useMediaQuery } from '@/hooks/use-media-query';
import type { SidebarState, LayoutConfig } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示侧边栏 */
  showSidebar?: boolean;
  /** 是否显示顶部导航栏 */
  showHeader?: boolean;
}

/**
 * 仪表盘主布局组件
 * 集成认证检查、响应式设计、侧边栏和顶部导航栏
 * 严格遵循App Router优先思维和shadcn/ui组件规范
 */
export function DashboardLayout({
  children,
  className,
  showSidebar = true,
  showHeader = true,
}: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');

  // 侧边栏状态管理
  const [sidebarState, setSidebarState] = React.useState<SidebarState>({
    isOpen: !isMobile,
    isCollapsed: isTablet,
    toggle: () =>
      setSidebarState(prev => ({
        ...prev,
        isCollapsed: !prev.isCollapsed,
      })),
    setOpen: (open: boolean) =>
      setSidebarState(prev => ({
        ...prev,
        isOpen: open,
      })),
    setCollapsed: (collapsed: boolean) =>
      setSidebarState(prev => ({
        ...prev,
        isCollapsed: collapsed,
      })),
  });

  // 移动端导航状态
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // 触摸手势状态
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  // 响应式布局调整
  React.useEffect(() => {
    if (isMobile) {
      setSidebarState(prev => ({
        ...prev,
        isOpen: false,
        isCollapsed: false,
      }));
      // 移动端时关闭移动导航
      setMobileNavOpen(false);
    } else if (isTablet) {
      setSidebarState(prev => ({
        ...prev,
        isOpen: true,
        isCollapsed: true,
      }));
    } else {
      setSidebarState(prev => ({
        ...prev,
        isOpen: true,
        isCollapsed: false,
      }));
    }
  }, [isMobile, isTablet]);

  // 手势处理
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

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
  };

  // 认证检查
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // 加载状态
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  // 未认证状态
  if (!session) {
    return null;
  }

  const layoutConfig: LayoutConfig = {
    showSidebar,
    showHeader,
    sidebarCollapsed: sidebarState.isCollapsed,
    isMobile,
    theme: 'light', // 后续可以从用户设置中获取
  };

  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {/* 顶部导航栏 */}
      {showHeader && (
        <Header
          showMobileMenuButton={isMobile}
          onMobileMenuClick={() => setMobileNavOpen(true)}
        />
      )}

      <div className="flex flex-1">
        {/* 桌面端侧边栏 */}
        {showSidebar && !isMobile && sidebarState.isOpen && (
          <Sidebar state={sidebarState} />
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
              sidebarState.isOpen &&
              (sidebarState.isCollapsed ? 'ml-0' : 'ml-0'),
            // 内边距调整
            isMobile ? 'p-4' : 'p-6',
            // 顶部间距调整（如果有header）
            showHeader && 'pt-6'
          )}
          onTouchStart={isMobile ? onTouchStart : undefined}
          onTouchMove={isMobile ? onTouchMove : undefined}
          onTouchEnd={isMobile ? onTouchEnd : undefined}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * 布局容器组件
 * 提供标准的内容容器样式
 */
interface LayoutContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function LayoutContainer({
  children,
  className,
  maxWidth = 'full',
}: LayoutContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  };

  return (
    <div className={cn('mx-auto w-full', maxWidthClasses[maxWidth], className)}>
      {children}
    </div>
  );
}

/**
 * 页面标题组件
 * 提供标准的页面标题样式
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between pb-6', className)}>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children && (
        <div className="flex items-center space-x-2">{children}</div>
      )}
    </div>
  );
}
