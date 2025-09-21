'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  HelpCircle,
  LayoutDashboard,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
    children: [
      {
        id: 'inventory-overview',
        title: '库存总览',
        href: '/inventory',
        icon: Warehouse,
      },
      {
        id: 'inventory-inbound-create',
        title: '产品入库',
        href: '/inventory/inbound/create',
        icon: Plus,
      },
      {
        id: 'inventory-inbound',
        title: '入库记录',
        href: '/inventory/inbound',
        icon: TrendingUp,
      },
      {
        id: 'inventory-outbound',
        title: '出库记录',
        href: '/inventory/outbound',
        icon: TrendingDown,
      },
    ],
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
    id: 'suppliers',
    title: '供应商管理',
    href: '/suppliers',
    icon: Truck,
  },
  {
    id: 'finance',
    title: '财务管理',
    href: '/finance',
    icon: DollarSign,
    children: [
      {
        id: 'finance-receivables',
        title: '应收货款',
        href: '/finance/receivables',
        icon: TrendingUp,
      },
      {
        id: 'finance-refunds',
        title: '应退货款',
        href: '/finance/refunds',
        icon: TrendingDown,
      },
      {
        id: 'finance-statements',
        title: '往来账单',
        href: '/finance/statements',
        icon: Receipt,
      },
    ],
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
  const { addBadgesToNavItems } = useNavigationBadges();

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
 * 支持键盘导航、hover效果、徽章显示、子菜单展开等功能
 */
const SidebarNavItem = React.forwardRef<HTMLAnchorElement, SidebarNavItemProps>(
  ({ item, isActive, isCollapsed, isFocused = false, tabIndex }, ref) => {
    const Icon = item.icon;
    const [isHovered, setIsHovered] = React.useState(false);
    const [isExpanded, setIsExpanded] = React.useState(false);
    const pathname = usePathname();

    // 检查是否有子菜单项处于激活状态
    const hasActiveChild = item.children?.some(
      child => pathname.startsWith(child.href) && child.href !== item.href
    );

    // 如果有激活的子菜单项，自动展开
    React.useEffect(() => {
      if (hasActiveChild && !isCollapsed) {
        setIsExpanded(true);
      }
    }, [hasActiveChild, isCollapsed]);

    // 如果没有子菜单，渲染普通导航项
    if (!item.children || item.children.length === 0) {
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
              isFocused && 'ring-0'
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

    // 渲染带子菜单的导航项
    return (
      <div className="space-y-1">
        <Button
          variant={isActive || hasActiveChild ? 'secondary' : 'ghost'}
          className={cn(
            'h-10 w-full justify-start transition-all duration-200',
            isCollapsed ? 'px-2' : 'px-3',
            (isActive || hasActiveChild) &&
              'bg-secondary font-medium shadow-sm',
            isHovered && !isActive && !hasActiveChild && 'bg-accent/50',
            isFocused && 'ring-2 ring-ring ring-offset-2'
          )}
          disabled={item.disabled}
          onClick={() => {
            if (isCollapsed) {
              // 折叠状态下直接跳转到主页面
              window.location.href = item.href;
            } else {
              // 展开状态下切换子菜单
              setIsExpanded(!isExpanded);
            }
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label={item.title}
          title={isCollapsed ? item.title : undefined}
          tabIndex={tabIndex}
        >
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
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isExpanded && 'rotate-180'
                )}
              />
              {item.badge && (
                <Badge
                  variant={item.badgeVariant || 'secondary'}
                  className={cn(
                    'ml-2 h-5 px-1.5 text-xs transition-all duration-200',
                    isHovered && 'scale-105'
                  )}
                >
                  {item.badge}
                </Badge>
              )}
            </>
          )}
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
        </Button>

        {/* 子菜单 */}
        {!isCollapsed && isExpanded && (
          <div className="ml-4 space-y-1 border-l border-border pl-4">
            {item.children.map(child => {
              const ChildIcon = child.icon;
              const isChildActive = pathname.startsWith(child.href);

              return (
                <Link
                  key={child.id}
                  href={child.href}
                  className={cn('block rounded-md transition-all duration-200')}
                >
                  <Button
                    variant={isChildActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'h-9 w-full justify-start text-sm transition-all duration-200',
                      'px-3',
                      isChildActive && 'bg-secondary font-medium shadow-sm'
                    )}
                    disabled={child.disabled}
                    asChild
                  >
                    <div>
                      <ChildIcon className="mr-3 h-3.5 w-3.5" />
                      <span className="flex-1 text-left">{child.title}</span>
                      {child.badge && (
                        <Badge
                          variant={child.badgeVariant || 'secondary'}
                          className="ml-auto h-4 px-1 text-xs"
                        >
                          {child.badge}
                        </Badge>
                      )}
                    </div>
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

SidebarNavItem.displayName = 'SidebarNavItem';
