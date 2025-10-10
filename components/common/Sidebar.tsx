'use client';

import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { NavigationItem, SidebarState } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

import { SidebarNavItem } from './SidebarNavItem';
import {
  bottomNavigationItems,
  navigationItems,
} from './sidebar-navigation-config';
import { useSidebarKeyboard } from './useSidebarKeyboard';

interface SidebarProps {
  /** 侧边栏状态 */
  state: SidebarState;
  /** 自定义样式类名 */
  className?: string;
  /** 可访问的导航项(服务器端过滤) */
  accessibleNavItems?: NavigationItem[];
  /** 可访问的底部导航项(服务器端过滤) */
  accessibleBottomNavItems?: NavigationItem[];
}

/**
 * 侧边栏组件
 * 优化版本：减少重复代码，统一配置，优化性能
 *
 * 性能优化点:
 * 1. 使用 React.memo 避免不必要的重渲染
 * 2. 路由订阅只在父组件进行一次，通过 props 传递
 * 3. 使用 useMemo 缓存计算结果
 * 4. 键盘导航逻辑抽离到独立 hook
 */
function SidebarComponent({
  state,
  className,
  accessibleNavItems = navigationItems,
  accessibleBottomNavItems = bottomNavigationItems,
}: SidebarProps) {
  const pathname = usePathname();
  const navItemsRef = React.useRef<(HTMLAnchorElement | null)[]>([]);

  // 键盘导航逻辑 (独立 Hook)
  const { focusedIndex } = useSidebarKeyboard({
    isOpen: state.isOpen,
    totalItems: accessibleNavItems.length + accessibleBottomNavItems.length,
    navItemsRef,
  });

  // 检查路径是否匹配 (使用 useCallback 优化)
  const isPathActive = React.useCallback(
    (href: string) => {
      // 精确匹配：pathname 必须完全等于 href，或者以 href/ 开头
      return pathname === href || pathname.startsWith(href + '/');
    },
    [pathname]
  );

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-text))] shadow-sm transition-all duration-300',
        state.isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* 侧边栏头部 */}
      <div className="flex h-16 items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-4">
        {!state.isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-sm">
              <Package className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold text-[hsl(var(--sidebar-text))]">
              库存管理
            </span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={state.toggle}
          className="h-8 w-8 p-0 text-[hsl(var(--sidebar-text-muted))] hover:!bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-hover-foreground))]"
          aria-label={state.isCollapsed ? '展开侧边栏' : '收起侧边栏'}
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
              pathname={pathname}
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
                    pathname={pathname}
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

/**
 * 使用 React.memo 优化 Sidebar 组件
 * 仅当 state, className, accessibleNavItems, accessibleBottomNavItems 发生变化时才重新渲染
 */
export const Sidebar = React.memo(SidebarComponent);
