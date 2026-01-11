'use client';

import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { NavigationItem, SidebarState } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

import {
    bottomNavigationItems,
    navigationItems,
} from './sidebar-navigation-config';
import { buildNavItemKey, SidebarNavItem } from './SidebarNavItem';
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
    (href: string) =>
      // 精确匹配：pathname 必须完全等于 href，或者以 href/ 开头
      pathname === href || pathname.startsWith(`${href}/`),
    [pathname]
  );

  return (
    <div
      className={cn(
        'relative flex h-full flex-col border-r border-slate-100 bg-white/80 backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]',
        state.isCollapsed ? 'w-20' : 'w-72',
        className
      )}
    >
      {/* 侧边栏头部: Identity Area */}
      <div className={cn(
        "flex items-center border-b border-slate-50 transition-all duration-500 px-4",
        state.isCollapsed ? "h-24 justify-center" : "h-24 justify-between"
      )}>
        {!state.isCollapsed ? (
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 shadow-lg shadow-slate-900/10 ring-4 ring-white">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tighter text-slate-900">
                库存管理
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                Control Center
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 shadow-xl shadow-slate-900/20 ring-4 ring-white">
            <Package className="h-6 w-6 text-white" />
          </div>
        )}

        {!state.isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={state.toggle}
            className="h-8 w-8 rounded-lg border border-slate-100 bg-white p-0 text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-90"
            aria-label="收起侧边栏"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 这里的浮动折叠按钮仅在折叠时显示，或者放在主体底部 */}
      {state.isCollapsed && (
        <button
          onClick={state.toggle}
          className="absolute -right-4 top-28 flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 bg-white shadow-md transition-all hover:scale-110 active:scale-95 z-50 text-slate-400 hover:text-slate-900"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* 主导航区域 */}
      <ScrollArea className="flex-1 px-4 py-8">
        <nav className="space-y-1.5" role="navigation" aria-label="主导航">
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
              nodeKey={buildNavItemKey(undefined, item, index)}
            />
          ))}
        </nav>

        {accessibleBottomNavItems.length > 0 && (
          <div className="mt-10 space-y-6">
            <div className="px-4">
              <div className="h-px bg-slate-100 w-full" />
            </div>

            {/* 底部辅助导航 */}
            <nav className="space-y-1.5" role="navigation" aria-label="辅助导航">
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
                    nodeKey={buildNavItemKey(undefined, item, globalIndex)}
                  />
                );
              })}
            </nav>
          </div>
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
