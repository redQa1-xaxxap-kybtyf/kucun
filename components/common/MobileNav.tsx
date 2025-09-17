'use client';

import {
    CreditCard,
    HelpCircle,
    LayoutDashboard,
    Package,
    RotateCcw,
    Settings,
    ShoppingCart,
    Users,
    Warehouse
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
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
import { useNavigationBadges } from '@/hooks/use-navigation-badges';
import type { NavigationItem } from '@/lib/types/layout';
import { cn } from '@/lib/utils';
import { getAccessibleNavItems } from '@/lib/utils/permissions';

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
    id: 'payments',
    title: '支付管理',
    href: '/payments',
    icon: CreditCard,
  },
];

/**
 * 移动端底部辅助功能导航
 */
const mobileBottomNavigationItems: NavigationItem[] = [
  {
    id: 'settings',
    title: '系统设置',
    href: '/settings',
    icon: Settings,
    requiredRoles: ['admin'],
  },
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
export function MobileNav({ open, onOpenChange, className }: MobileNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { addBadgesToNavItems } = useNavigationBadges();

  // 触摸手势状态
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  // 根据用户权限过滤导航项
  const accessibleNavItems = React.useMemo(() => {
    if (!session?.user?.role) return [];

    const filteredItems = getAccessibleNavItems(
      mobileNavigationItems,
      session.user.role
    );
    return addBadgesToNavItems(filteredItems);
  }, [session?.user?.role, addBadgesToNavItems]);

  const accessibleBottomNavItems = React.useMemo(() => {
    if (!session?.user?.role) return [];

    const filteredItems = getAccessibleNavItems(
      mobileBottomNavigationItems,
      session.user.role
    );
    return addBadgesToNavItems(filteredItems);
  }, [session?.user?.role, addBadgesToNavItems]);

  const handleNavItemClick = () => {
    // 点击导航项后关闭抽屉
    onOpenChange(false);
  };

  // 检查路径是否匹配（支持子路由）
  const isPathActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

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

    // 向左滑动关闭抽屉
    if (isLeftSwipe) {
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className={cn('w-80 p-0', className)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
                <Package className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold">库存管理</span>
            </SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {/* 主导航区域 */}
          <nav className="space-y-2" role="navigation" aria-label="主导航">
            {accessibleNavItems.map(item => (
              <MobileNavItem
                key={item.id}
                item={item}
                isActive={isPathActive(item.href)}
                onClick={handleNavItemClick}
              />
            ))}
          </nav>

          {accessibleBottomNavItems.length > 0 && (
            <>
              <Separator className="my-6" />

              {/* 底部辅助导航 */}
              <nav
                className="space-y-2"
                role="navigation"
                aria-label="辅助导航"
              >
                {accessibleBottomNavItems.map(item => (
                  <MobileNavItem
                    key={item.id}
                    item={item}
                    isActive={isPathActive(item.href)}
                    onClick={handleNavItemClick}
                  />
                ))}
              </nav>
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface MobileNavItemProps {
  item: NavigationItem;
  isActive: boolean;
  onClick: () => void;
}

/**
 * 移动端导航项组件
 * 优化的移动端交互体验
 */
function MobileNavItem({ item, isActive, onClick }: MobileNavItemProps) {
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
          isActive && 'bg-secondary font-medium shadow-sm',
          'touch-manipulation active:scale-95'
        )}
        disabled={item.disabled}
        asChild
      >
        <div>
          <Icon className="mr-3 h-5 w-5" />
          <span className="flex-1 text-left text-base">{item.title}</span>
          {item.badge && (
            <Badge
              variant={item.badgeVariant || 'secondary'}
              className="ml-auto h-5 px-2 text-xs"
            >
              {item.badge}
            </Badge>
          )}
        </div>
      </Button>
    </Link>
  );
}

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
