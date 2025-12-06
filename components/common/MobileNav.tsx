'use client';

import { ChevronDown, Package } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { getAccessibleNavItems } from '@/lib/auth/permissions';
import type { NavigationItem } from '@/lib/types/layout';
import type { UserRole } from '@/lib/types/user';
import { cn } from '@/lib/utils';

import {
  bottomNavigationItems,
  navigationItems,
} from './sidebar-navigation-config';

interface MobileNavProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 移动端抽屉式导航菜单组件
 * 提供与桌面端一致的导航功能，适配移动端交互
 * 集成权限控制、徽章显示、手势支持等功能
 */
function MobileNavComponent({ open, onOpenChange, className }: MobileNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  const { mainNavItems, bottomNavItems } = useAccessibleNavigation(userRole);
  const swipeHandlers = useSwipeToClose(() => onOpenChange(false));

  const handleNavItemClick = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const isPathActive = React.useCallback(
    (href: string) =>
      href === '/dashboard'
        ? pathname === '/dashboard'
        : pathname.startsWith(href),
    [pathname]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <MobileNavSheetContent
        className={className}
        swipeHandlers={swipeHandlers}
        mainNavItems={mainNavItems}
        bottomNavItems={bottomNavItems}
        isPathActive={isPathActive}
        onItemClick={handleNavItemClick}
        pathname={pathname}
      />
    </Sheet>
  );
}

interface AccessibleNavigation {
  mainNavItems: NavigationItem[];
  bottomNavItems: NavigationItem[];
}

const useAccessibleNavigation = (userRole?: UserRole): AccessibleNavigation =>
  React.useMemo(() => {
    if (!userRole) {
      return { mainNavItems: [], bottomNavItems: [] };
    }

    const castItems = navigationItems as Array<{
      requiredRoles?: UserRole[];
    }>;
    const castBottomItems = bottomNavigationItems as Array<{
      requiredRoles?: UserRole[];
    }>;

    return {
      mainNavItems: getAccessibleNavItems(
        castItems,
        userRole
      ) as NavigationItem[],
      bottomNavItems: getAccessibleNavItems(
        castBottomItems,
        userRole
      ) as NavigationItem[],
    };
  }, [userRole]);

interface SwipeHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

const SWIPE_CLOSE_THRESHOLD = 50;

const useSwipeToClose = (onClose: () => void): SwipeHandlers => {
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  const handleTouchStart = React.useCallback((event: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(event.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = React.useCallback((event: React.TouchEvent) => {
    setTouchEnd(event.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = React.useCallback(() => {
    if (touchStart === null || touchEnd === null) {
      return;
    }

    const distance = touchStart - touchEnd;
    if (distance > SWIPE_CLOSE_THRESHOLD) {
      onClose();
    }
  }, [touchEnd, touchStart, onClose]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};

interface MobileNavSheetContentProps {
  className?: string;
  swipeHandlers: SwipeHandlers;
  mainNavItems: NavigationItem[];
  bottomNavItems: NavigationItem[];
  isPathActive: (href: string) => boolean;
  onItemClick: () => void;
  pathname: string;
}

const MobileNavSheetContent = ({
  className,
  swipeHandlers,
  mainNavItems,
  bottomNavItems,
  isPathActive,
  onItemClick,
  pathname,
}: MobileNavSheetContentProps) => (
  <SheetContent
    side="left"
    // 使用 flex 布局 + h-full，让内部 ScrollArea 真正可滚动
    className={cn('flex h-full min-h-0 w-80 flex-col p-0', className)}
    {...swipeHandlers}
  >
    <SheetHeader className="border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <SheetTitle className="flex items-center space-x-2">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded">
            <Package className="text-primary-foreground h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">库存管理</span>
        </SheetTitle>
      </div>
    </SheetHeader>

    <ScrollArea className="flex-1 px-6 py-4">
      <NavSection
        items={mainNavItems}
        onItemClick={onItemClick}
        isPathActive={isPathActive}
        ariaLabel="主导航"
        pathname={pathname}
      />

      {bottomNavItems.length > 0 ? (
        <>
          <Separator className="my-6" />
          <NavSection
            items={bottomNavItems}
            onItemClick={onItemClick}
            isPathActive={isPathActive}
            ariaLabel="辅助导航"
            pathname={pathname}
          />
        </>
      ) : null}
    </ScrollArea>
  </SheetContent>
);

interface NavSectionProps {
  items: NavigationItem[];
  isPathActive: (href: string) => boolean;
  onItemClick: () => void;
  ariaLabel: string;
  pathname: string;
}

const NavSection = ({
  items,
  isPathActive,
  onItemClick,
  ariaLabel,
  pathname,
}: NavSectionProps) => (
  <nav className="space-y-2" role="navigation" aria-label={ariaLabel}>
    {items.map(item => (
      <MobileNavItem
        key={item.id}
        item={item}
        isActive={isPathActive(item.href)}
        onClick={onItemClick}
        pathname={pathname}
      />
    ))}
  </nav>
);

interface MobileNavItemProps {
  item: NavigationItem;
  isActive: boolean;
  onClick: () => void;
  pathname?: string;
}

/**
 * 移动端导航项组件
 * 优化的移动端交互体验,支持子菜单展开/收起
 */
const MobileNavItem = React.memo(
  ({ item, isActive, onClick, pathname }: MobileNavItemProps) => {
    const Icon = item.icon;
    const [isPressed, setIsPressed] = React.useState(false);
    const [isExpanded, setIsExpanded] = React.useState(false);

    // 检查是否有子菜单
    const hasChildren = item.children && item.children.length > 0;

    // 检查是否有激活的子菜单项
    const hasActiveChild = React.useMemo(
      () =>
        pathname &&
        item.children?.some(
          child =>
            pathname === child.href || pathname.startsWith(`${child.href}/`)
        ),
      [item.children, pathname]
    );

    // 如果有激活的子菜单项,自动展开
    React.useEffect(() => {
      if (hasActiveChild) {
        setIsExpanded(true);
      }
    }, [hasActiveChild]);

    // 处理点击事件
    const handleClick = React.useCallback(
      (e: React.MouseEvent) => {
        if (hasChildren) {
          e.preventDefault();
          setIsExpanded(prev => !prev);
        } else {
          onClick();
        }
      },
      [hasChildren, onClick]
    );

    // 如果没有子菜单,渲染普通链接
    if (!hasChildren) {
      return (
        <Link
          href={item.href}
          onClick={onClick}
          className={cn(
            'block rounded-lg transition-all duration-200',
            isPressed && 'scale-95'
          )}
          onTouchStart={() => setIsPressed(true)}
          onTouchEnd={() => setIsPressed(false)}
          onTouchCancel={() => setIsPressed(false)}
          aria-label={item.title}
        >
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            className={cn(
              'h-12 w-full justify-start px-4 transition-all duration-200',
              isActive && 'bg-secondary font-medium shadow-xs',
              'touch-manipulation active:scale-95'
            )}
            disabled={item.disabled}
            asChild
          >
            <div>
              <Icon className="mr-3 h-5 w-5" />
              <span className="flex-1 text-left text-base">{item.title}</span>
            </div>
          </Button>
        </Link>
      );
    }

    // 渲染带子菜单的项
    return (
      <div className="space-y-1">
        <Button
          variant={isActive || hasActiveChild ? 'secondary' : 'ghost'}
          className={cn(
            'h-12 w-full justify-start px-4 transition-all duration-200',
            (isActive || hasActiveChild) &&
              'bg-secondary font-medium shadow-xs',
            'touch-manipulation active:scale-95'
          )}
          disabled={item.disabled}
          onClick={handleClick}
          onTouchStart={() => setIsPressed(true)}
          onTouchEnd={() => setIsPressed(false)}
          onTouchCancel={() => setIsPressed(false)}
          aria-expanded={isExpanded}
        >
          <Icon className="mr-3 h-5 w-5" />
          <span className="flex-1 text-left text-base">{item.title}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        </Button>

        {/* 子菜单 */}
        {isExpanded && (
          <div className="border-border ml-4 space-y-1 border-l-2 pl-2">
            {item.children?.map(child => {
              const isChildActive =
                pathname === child.href ||
                (pathname && pathname.startsWith(`${child.href}/`));
              return (
                <MobileNavItem
                  key={child.id}
                  item={child}
                  isActive={!!isChildActive}
                  onClick={onClick}
                  pathname={pathname}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
);
MobileNavItem.displayName = 'MobileNavItem';

/**
 * 移动端导航触发器组件
 * 可以单独使用，也可以集成到Header组件中
 */
interface MobileNavTriggerProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNavTrigger({
  children,
  open,
  onOpenChange,
}: MobileNavTriggerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <MobileNav open={open} onOpenChange={onOpenChange} />
    </Sheet>
  );
}

/**
 * 使用 React.memo 优化 MobileNav 组件
 * 避免因父组件重渲染导致的不必要更新
 */
export const MobileNav = React.memo(MobileNavComponent);
