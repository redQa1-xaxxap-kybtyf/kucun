'use client';

import { ChevronLeft, ChevronRight, Info, Package } from 'lucide-react';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSystemVersion } from '@/hooks/use-system-version';
import type { NavigationItem, SidebarState } from '@/lib/types/layout';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/console-logger';

import { SidebarNavItem, buildNavItemKey } from './SidebarNavItem';
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
  const { version, systemName } = useSystemVersion();

  const totalItems =
    accessibleNavItems.length + accessibleBottomNavItems.length;
  const { focusedIndex } = useSidebarKeyboard({
    isOpen: state.isOpen,
    totalItems,
    navItemsRef,
  });

  const isPathActive = useIsPathActive(pathname);
  useDuplicateNavKeyWarnings(accessibleNavItems);

  const getNavItemRef = React.useCallback(
    (index: number) => (el: HTMLAnchorElement | null) => {
      navItemsRef.current[index] = el;
    },
    []
  );

  return (
    <div
      className={cn(
        'bg-background fixed top-16 left-0 z-40 flex h-[calc(100vh-4rem)] flex-col border-r transition-all duration-300',
        state.isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <SidebarHeader state={state} />
      <ScrollArea className="flex-1 px-3 py-4">
        <SidebarNavigation
          topItems={accessibleNavItems}
          bottomItems={accessibleBottomNavItems}
          isCollapsed={state.isCollapsed}
          isPathActive={isPathActive}
          focusedIndex={focusedIndex}
          getNavItemRef={getNavItemRef}
          pathname={pathname}
        />
      </ScrollArea>

      {/* 系统版本信息 */}
      <div
        className={cn('border-t px-4 py-3', state.isCollapsed && 'px-2 py-2')}
      >
        <TooltipProvider>
          <div
            className={cn(
              'text-muted-foreground text-xs',
              state.isCollapsed
                ? 'flex justify-center'
                : 'flex items-center justify-between'
            )}
          >
            {!state.isCollapsed ? (
              <>
                <span className="font-medium">{systemName}</span>
                <span className="font-mono font-semibold">v{version}</span>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">
                    {systemName} v{version}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}

function SidebarHeader({ state }: { state: SidebarState }) {
  return (
    <div className="flex h-16 items-center justify-between border-b px-4">
      {!state.isCollapsed && (
        <div className="flex items-center space-x-2">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded">
            <Package className="text-primary-foreground h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">库存管理</span>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={state.toggle}
        className="h-8 w-8 p-0"
        aria-label={state.isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {state.isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

interface SidebarNavigationProps {
  topItems: NavigationItem[];
  bottomItems: NavigationItem[];
  isCollapsed: boolean;
  isPathActive: (href: string) => boolean;
  focusedIndex: number;
  getNavItemRef: (index: number) => (el: HTMLAnchorElement | null) => void;
  pathname: string;
}

function SidebarNavigation({
  topItems,
  bottomItems,
  isCollapsed,
  isPathActive,
  focusedIndex,
  getNavItemRef,
  pathname,
}: SidebarNavigationProps) {
  return (
    <>
      <SideNavSection
        ariaLabel="主导航"
        items={topItems}
        isCollapsed={isCollapsed}
        isPathActive={isPathActive}
        focusedIndex={focusedIndex}
        getNavItemRef={getNavItemRef}
        currentPath={pathname}
      />

      {bottomItems.length > 0 && (
        <>
          <Separator className="my-4" />
          <SideNavSection
            ariaLabel="辅助导航"
            items={bottomItems}
            isCollapsed={isCollapsed}
            isPathActive={isPathActive}
            focusedIndex={focusedIndex}
            getNavItemRef={index => getNavItemRef(topItems.length + index)}
            startIndex={topItems.length}
            currentPath={pathname}
          />
        </>
      )}
    </>
  );
}

interface SideNavSectionProps {
  ariaLabel: string;
  items: NavigationItem[];
  isCollapsed: boolean;
  isPathActive: (href: string) => boolean;
  focusedIndex: number;
  getNavItemRef: (index: number) => (el: HTMLAnchorElement | null) => void;
  startIndex?: number;
  currentPath: string;
}

function SideNavSection({
  ariaLabel,
  items,
  isCollapsed,
  isPathActive,
  focusedIndex,
  getNavItemRef,
  startIndex = 0,
  currentPath,
}: SideNavSectionProps) {
  return (
    <nav className="space-y-2" role="navigation" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const globalIndex = startIndex + index;
        const itemKey = buildNavItemKey(
          startIndex > 0 ? 'bottom' : undefined,
          item,
          index
        );

        return (
          <SidebarNavItem
            key={itemKey}
            nodeKey={itemKey}
            item={item}
            pathname={currentPath}
            isActive={isPathActive(item.href)}
            isCollapsed={isCollapsed}
            isFocused={focusedIndex === globalIndex}
            ref={getNavItemRef(globalIndex)}
            tabIndex={focusedIndex === globalIndex ? 0 : -1}
          />
        );
      })}
    </nav>
  );
}

function useIsPathActive(pathname: string) {
  return React.useCallback(
    (href: string) => {
      if (href === '/dashboard') {
        return pathname === '/dashboard';
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );
}

function useDuplicateNavKeyWarnings(navItems: NavigationItem[]) {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const topKeys = navItems.map((item, index) =>
      buildNavItemKey(undefined, item, index)
    );
    const duplicateTopKeys = findDuplicates(topKeys);

    if (duplicateTopKeys.length > 0) {
      logger.warn('sidebar.duplicate-top-nav-keys', {
        duplicateKeys: duplicateTopKeys,
      });
    }

    navItems.forEach((item, parentIndex) => {
      if (!item.children?.length) {
        return;
      }
      const parentKey = buildNavItemKey(undefined, item, parentIndex);
      const childKeys = item.children.map((child, index) =>
        buildNavItemKey(parentKey, child, index)
      );
      const duplicateChildKeys = findDuplicates(childKeys);

      if (duplicateChildKeys.length > 0) {
        logger.warn('sidebar.duplicate-child-nav-keys', {
          parentId: item.id,
          duplicateKeys: duplicateChildKeys,
        });
      }
    });
  }, [navItems]);
}

function findDuplicates(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}
