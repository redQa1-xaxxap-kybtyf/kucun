'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { NavigationItem } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

/**
 * 子菜单列表组件（优化：接收 pathname 作为 prop，避免重复订阅路由）
 */
interface ChildMenuListProps {
  children: NavigationItem[];
  pathname: string;
}

const ChildMenuList = React.memo(
  ({ children, pathname }: ChildMenuListProps) => {
    const items = children;
    return (
      <div className="border-border ml-4 space-y-1 border-l pl-4">
        {items.map(child => {
          const ChildIcon = child.icon;
          const isChildActive = pathname.startsWith(child.href);

          return (
            <Link
              key={child.id}
              href={child.href}
              prefetch={false}
              className={cn('block rounded-md transition-all duration-150')}
            >
              <Button
                variant={isChildActive ? 'secondary' : 'ghost'}
                className={cn(
                  'h-9 w-full justify-start text-sm transition-all duration-150',
                  'px-3',
                  isChildActive && 'bg-secondary font-medium shadow-xs'
                )}
                disabled={child.disabled}
                asChild
              >
                <div>
                  <ChildIcon className="mr-3 h-3.5 w-3.5" />
                  <span className="flex-1 text-left">{child.title}</span>
                </div>
              </Button>
            </Link>
          );
        })}
      </div>
    );
  }
);

ChildMenuList.displayName = 'ChildMenuList';

interface SidebarNavItemProps {
  item: NavigationItem;
  pathname: string;
  isActive: boolean;
  isCollapsed: boolean;
  isFocused?: boolean;
  tabIndex?: number;
}

/**
 * 侧边栏导航项 Client Component
 * 优化版本：通过 props 接收 pathname，避免每个导航项都订阅路由
 *
 * 性能优化点:
 * 1. pathname 通过 props 传递，避免重复订阅
 * 2. 使用 React.memo 避免不必要的重渲染
 * 3. 使用 useCallback 优化事件处理函数
 * 4. 禁用 Link 预取 (prefetch={false})
 * 5. 减少动画时长 (200ms -> 150ms)
 */
export const SidebarNavItem = React.memo(
  React.forwardRef<HTMLAnchorElement, SidebarNavItemProps>(
    (
      { item, pathname, isActive, isCollapsed, isFocused = false, tabIndex },
      ref
    ) => {
      const Icon = item.icon;
      const [isExpanded, setIsExpanded] = React.useState(false);

      // ✅ 检查是否有子菜单项处于激活状态（使用 useMemo 优化）
      const hasActiveChild = React.useMemo(
        () =>
          item.children?.some(
            child => pathname.startsWith(child.href) && child.href !== item.href
          ) ?? false,
        [item.children, item.href, pathname]
      );

      // ✅ 如果有激活的子菜单项，自动展开
      React.useEffect(() => {
        if (hasActiveChild && !isCollapsed) {
          setIsExpanded(true);
        }
      }, [hasActiveChild, isCollapsed]);

      // ✅ 处理子菜单展开/收起 (使用 useCallback 优化)
      const handleSubMenuToggle = React.useCallback(() => {
        setIsExpanded(prev => !prev);
      }, []);

      // 如果没有子菜单，渲染普通导航项
      if (!item.children || item.children.length === 0) {
        return (
          <Link
            href={item.href}
            ref={ref}
            tabIndex={tabIndex}
            prefetch={true}
            className={cn(
              'block rounded-md transition-all duration-150',
              isFocused && 'ring-ring ring-2 ring-offset-2'
            )}
            aria-label={item.title}
            title={isCollapsed ? item.title : undefined}
          >
            <Button
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'h-10 w-full justify-start transition-all duration-150',
                isCollapsed ? 'px-2' : 'px-3',
                isActive && 'bg-secondary font-medium shadow-xs',
                'hover:bg-accent/50',
                isFocused && 'ring-0'
              )}
              disabled={item.disabled}
              asChild
            >
              <div>
                <Icon
                  className={cn(
                    'h-4 w-4 transition-transform duration-150',
                    !isCollapsed && 'mr-3'
                  )}
                />
                {!isCollapsed && (
                  <span className="flex-1 text-left">{item.title}</span>
                )}
              </div>
            </Button>
          </Link>
        );
      }

      // 渲染带子菜单的导航项
      return (
        <div className="space-y-1">
          {/* 折叠状态下，父菜单可点击导航 */}
          {isCollapsed ? (
            <Link
              href={item.href}
              prefetch={true}
              className={cn(
                'block rounded-md transition-all duration-150',
                isFocused && 'ring-ring ring-2 ring-offset-2'
              )}
              aria-label={item.title}
              title={item.title}
            >
              <Button
                variant={isActive || hasActiveChild ? 'secondary' : 'ghost'}
                className={cn(
                  'h-10 w-full justify-start transition-all duration-150',
                  'px-2',
                  (isActive || hasActiveChild) &&
                    'bg-secondary font-medium shadow-xs',
                  'hover:bg-accent/50',
                  isFocused && 'ring-0'
                )}
                disabled={item.disabled}
                asChild
              >
                <div>
                  <Icon className="h-4 w-4 transition-transform duration-150" />
                </div>
              </Button>
            </Link>
          ) : (
            /* 展开状态下，父菜单用于切换子菜单显示 */
            <>
              <Button
                variant={isActive || hasActiveChild ? 'secondary' : 'ghost'}
                className={cn(
                  'group h-10 w-full justify-start transition-all duration-150',
                  'px-3',
                  (isActive || hasActiveChild) &&
                    'bg-secondary font-medium shadow-xs',
                  'hover:bg-accent/50',
                  isFocused && 'ring-ring ring-2 ring-offset-2'
                )}
                disabled={item.disabled}
                onClick={handleSubMenuToggle}
                aria-label={item.title}
                aria-expanded={isExpanded}
                tabIndex={tabIndex}
              >
                <Icon className="mr-3 h-4 w-4 transition-transform duration-150" />
                <span className="flex-1 text-left">{item.title}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-150',
                    isExpanded && 'rotate-180'
                  )}
                />
              </Button>

              {/* 子菜单 */}
              {isExpanded && (
                <ChildMenuList pathname={pathname}>
                  {item.children}
                </ChildMenuList>
              )}
            </>
          )}
        </div>
      );
    }
  )
);

SidebarNavItem.displayName = 'SidebarNavItem';
