'use client';

import {
    ChevronLeft,
    ChevronRight,
    CreditCard,
    HelpCircle,
    LayoutDashboard,
    Package,
    RotateCcw,
    Settings,
    ShoppingBag,
    ShoppingCart,
    Users,
    Warehouse,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNavigationBadges } from '@/hooks/use-navigation-badges';
import type { NavigationItem, SidebarState } from '@/lib/types/layout';
import { cn } from '@/lib/utils';
import { getAccessibleNavItems } from '@/lib/utils/permissions';

/**
 * 主要功能模块导航配置
 * 严格按照项目要求包含所有功能模块
 */
const navigationItems: NavigationItem[] = [
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
    id: 'purchase-orders',
    title: '采购订单',
    href: '/purchase-orders',
    icon: ShoppingBag,
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
 * 底部辅助功能导航
 */
const bottomNavigationItems: NavigationItem[] = [
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

interface SidebarProps {
  /** 侧边栏状态 */
  state: SidebarState;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 侧边栏组件
 * 包含主要功能模块导航、当前页面高亮、折叠展开功能
 * 集成权限控制、徽章显示、键盘导航等功能
 */
export function Sidebar({ state, className }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { addBadgesToNavItems, isLoading: badgesLoading } =
    useNavigationBadges();

  // 键盘导航状态
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const navItemsRef = React.useRef<(HTMLAnchorElement | null)[]>([]);

  // 根据用户权限过滤导航项
  const accessibleNavItems = React.useMemo(() => {
    if (!session?.user?.role) return [];

    const filteredItems = getAccessibleNavItems(
      navigationItems,
      session.user.role
    );
    return addBadgesToNavItems(filteredItems);
  }, [session?.user?.role, addBadgesToNavItems]);

  const accessibleBottomNavItems = React.useMemo(() => {
    if (!session?.user?.role) return [];

    const filteredItems = getAccessibleNavItems(
      bottomNavigationItems,
      session.user.role
    );
    return addBadgesToNavItems(filteredItems);
  }, [session?.user?.role, addBadgesToNavItems]);

  // 键盘导航处理
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!state.isOpen) return;

      const totalItems =
        accessibleNavItems.length + accessibleBottomNavItems.length;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedIndex >= 0 && navItemsRef.current[focusedIndex]) {
            navItemsRef.current[focusedIndex]?.click();
          }
          break;
        case 'Escape':
          setFocusedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    state.isOpen,
    accessibleNavItems.length,
    accessibleBottomNavItems.length,
    focusedIndex,
  ]);

  // 检查路径是否匹配（支持子路由）
  const isPathActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r bg-background transition-all duration-300',
        state.isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* 侧边栏头部 */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!state.isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">库存管理</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={state.toggle}
          className="h-8 w-8 p-0"
        >
          {state.isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 主导航区域 */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-2" role="navigation" aria-label="主导航">
          {accessibleNavItems.map((item, index) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              isActive={isPathActive(item.href)}
              isCollapsed={state.isCollapsed}
              isFocused={focusedIndex === index}
              ref={el => {
                navItemsRef.current[index] = el;
              }}
              tabIndex={focusedIndex === index ? 0 : -1}
            />
          ))}
        </nav>

        {accessibleBottomNavItems.length > 0 && (
          <>
            <Separator className="my-4" />

            {/* 底部辅助导航 */}
            <nav className="space-y-2" role="navigation" aria-label="辅助导航">
              {accessibleBottomNavItems.map((item, index) => {
                const globalIndex = accessibleNavItems.length + index;
                return (
                  <SidebarNavItem
                    key={item.id}
                    item={item}
                    isActive={isPathActive(item.href)}
                    isCollapsed={state.isCollapsed}
                    isFocused={focusedIndex === globalIndex}
                    ref={el => {
                      navItemsRef.current[globalIndex] = el;
                    }}
                    tabIndex={focusedIndex === globalIndex ? 0 : -1}
                  />
                );
              })}
            </nav>
          </>
        )}
      </ScrollArea>
    </div>
  );
}

interface SidebarNavItemProps {
  item: NavigationItem;
  isActive: boolean;
  isCollapsed: boolean;
  isFocused?: boolean;
  tabIndex?: number;
}

/**
 * 侧边栏导航项组件
 * 支持键盘导航、hover效果、徽章显示等功能
 */
const SidebarNavItem = React.forwardRef<HTMLAnchorElement, SidebarNavItemProps>(
  ({ item, isActive, isCollapsed, isFocused = false, tabIndex }, ref) => {
    const Icon = item.icon;
    const [isHovered, setIsHovered] = React.useState(false);

    return (
      <Link
        href={item.href}
        ref={ref}
        tabIndex={tabIndex}
        className={cn(
          'block rounded-md transition-all duration-200',
          isFocused && 'ring-2 ring-ring ring-offset-2'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={item.title}
        title={isCollapsed ? item.title : undefined}
      >
        <Button
          variant={isActive ? 'secondary' : 'ghost'}
          className={cn(
            'h-10 w-full justify-start transition-all duration-200',
            isCollapsed ? 'px-2' : 'px-3',
            isActive && 'bg-secondary font-medium shadow-sm',
            isHovered && !isActive && 'bg-accent/50',
            isFocused && 'ring-0' // 移除Button的默认focus ring，使用Link的ring
          )}
          disabled={item.disabled}
          asChild
        >
          <div>
            <Icon
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                !isCollapsed && 'mr-3',
                isHovered && 'scale-110'
              )}
            />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">{item.title}</span>
                {item.badge && (
                  <Badge
                    variant={item.badgeVariant || 'secondary'}
                    className={cn(
                      'ml-auto h-5 px-1.5 text-xs transition-all duration-200',
                      isHovered && 'scale-105'
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
            {/* 折叠状态下的徽章显示 */}
            {isCollapsed && item.badge && (
              <Badge
                variant={item.badgeVariant || 'secondary'}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center p-0 text-xs"
              >
                {typeof item.badge === 'number' && item.badge > 9
                  ? '9+'
                  : item.badge}
              </Badge>
            )}
          </div>
        </Button>
      </Link>
    );
  }
);

SidebarNavItem.displayName = 'SidebarNavItem';
