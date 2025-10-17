'use client';

import {
  DollarSign,
  FolderTree,
  HelpCircle,
  LayoutDashboard,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react';
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

/**
 * 移动端导航菜单配置
 * 与桌面端保持一致的功能模块
 */
const mobileNavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    title: '仪表盘',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'inventory',
    title: '库存管理',
    href: '/inventory',
    icon: Warehouse,
  },
  {
    id: 'products',
    title: '产品管理',
    href: '/products',
    icon: Package,
  },
  {
    id: 'categories',
    title: '分类管理',
    href: '/categories',
    icon: FolderTree,
  },
  {
    id: 'sales-orders',
    title: '销售订单',
    href: '/sales-orders',
    icon: ShoppingCart,
  },
  {
    id: 'return-orders',
    title: '退货订单',
    href: '/return-orders',
    icon: RotateCcw,
  },
  {
    id: 'customers',
    title: '客户管理',
    href: '/customers',
    icon: Users,
  },
  {
    id: 'finance',
    title: '财务管理',
    href: '/finance',
    icon: DollarSign,
  },
  {
    id: 'settings',
    title: '系统设置',
    href: '/settings',
    icon: Settings,
    requiredRoles: ['admin'],
  },
];

/**
 * 移动端底部辅助功能导航
 */
const mobileBottomNavigationItems: NavigationItem[] = [
  {
    id: 'help',
    title: '帮助中心',
    href: '/help',
    icon: HelpCircle,
  },
];

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

    const castItems = mobileNavigationItems as Array<{
      requiredRoles?: UserRole[];
    }>;
    const castBottomItems = mobileBottomNavigationItems as Array<{
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
}

const MobileNavSheetContent = ({
  className,
  swipeHandlers,
  mainNavItems,
  bottomNavItems,
  isPathActive,
  onItemClick,
}: MobileNavSheetContentProps) => (
  <SheetContent
    side="left"
    className={cn('w-80 p-0', className)}
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
      />

      {bottomNavItems.length > 0 ? (
        <>
          <Separator className="my-6" />
          <NavSection
            items={bottomNavItems}
            onItemClick={onItemClick}
            isPathActive={isPathActive}
            ariaLabel="辅助导航"
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
}

const NavSection = ({
  items,
  isPathActive,
  onItemClick,
  ariaLabel,
}: NavSectionProps) => (
  <nav className="space-y-2" role="navigation" aria-label={ariaLabel}>
    {items.map(item => (
      <MobileNavItem
        key={item.id}
        item={item}
        isActive={isPathActive(item.href)}
        onClick={onItemClick}
      />
    ))}
  </nav>
);

interface MobileNavItemProps {
  item: NavigationItem;
  isActive: boolean;
  onClick: () => void;
}

/**
 * 移动端导航项组件
 * 优化的移动端交互体验
 */
const MobileNavItem = React.memo(
  ({ item, isActive, onClick }: MobileNavItemProps) => {
    const Icon = item.icon;
    const [isPressed, setIsPressed] = React.useState(false);

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
