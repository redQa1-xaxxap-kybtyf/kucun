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
import { useSidebarKeyboard } from './useSidebarKeyboard';

interface SidebarClientProps {
  /** 侧边栏状态 */
  state: SidebarState;
  /** 自定义样式类名 */
  className?: string;
  /** 可访问的导航项(服务器端过滤) */
  accessibleNavItems: NavigationItem[];
  /** 可访问的底部导航项(服务器端过滤) */
  accessibleBottomNavItems: NavigationItem[];
}

/**
 * Sidebar Client Component
 * 仅包含交互逻辑(键盘导航、折叠状态)
 * 接收服务器端过滤后的导航项,避免客户端等待 Session
 */
export function SidebarClient({
  state,
  className,
  accessibleNavItems,
  accessibleBottomNavItems,
}: SidebarClientProps) {
  const pathname = usePathname();
  const navItemsRef = React.useRef<(HTMLAnchorElement | null)[]>([]);

  // 键盘导航(独立 Hook)
  const { focusedIndex } = useSidebarKeyboard({
    isOpen: state.isOpen,
    totalItems: accessibleNavItems.length + accessibleBottomNavItems.length,
    navItemsRef,
  });

  // 检查路径是否匹配(支持子路由)
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
