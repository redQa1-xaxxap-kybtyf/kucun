'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { startTransition } from 'react';

import { Button } from '@/components/ui/button';
import type { NavigationItem } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

/**
 * 子菜单列表组件（优化：减少路由订阅数量）
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
              className={cn('block rounded-md transition-all duration-200')}
            >
              <Button
                variant={isChildActive ? 'secondary' : 'ghost'}
                className={cn(
                  'h-9 w-full justify-start text-sm transition-all duration-200',
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
  isActive: boolean;
  isCollapsed: boolean;
  isFocused?: boolean;
  tabIndex?: number;
}

/**
 * 侧边栏导航项 Client Component
 * 支持键盘导航、hover效果、子菜单展开等功能
 * 使用 React.memo 优化渲染性能
 */
export const SidebarNavItem = React.memo(
  React.forwardRef<HTMLAnchorElement, SidebarNavItemProps>(
    ({ item, isActive, isCollapsed, isFocused = false, tabIndex }, ref) => {
      const Icon = item.icon;
      const [isExpanded, setIsExpanded] = React.useState(false);
      const [isNavigating, setIsNavigating] = React.useState(false);
      const pathname = usePathname();
      const router = useRouter();

      // ✅ 使用useRef管理timeout，避免内存泄漏
      const navTimeoutRef = React.useRef<number | null>(null);
      // ✅ 防抖：记录上次点击时间，避免快速连续点击
      const lastClickTimeRef = React.useRef<number>(0);

      // ✅ 检查是否有子菜单项处于激活状态（使用 useMemo 优化）
      const hasActiveChild = React.useMemo(
        () =>
          item.children?.some(
            child => pathname.startsWith(child.href) && child.href !== item.href
          ) ?? false,
        [item.children, item.href, pathname]
      );

      // ✅ 如果有激活的子菜单项，自动展开（优化：添加防抖）
      React.useEffect(() => {
        if (hasActiveChild && !isCollapsed) {
          // 使用 requestAnimationFrame 延迟执行，避免阻塞渲染
          const timeoutId = requestAnimationFrame(() => {
            setIsExpanded(true);
          });
          return () => cancelAnimationFrame(timeoutId);
        }
      }, [hasActiveChild, isCollapsed]);

      // ✅ 清理timeout，避免内存泄漏和状态混乱
      React.useEffect(() => {
        return () => {
          if (navTimeoutRef.current) {
            clearTimeout(navTimeoutRef.current);
          }
        };
      }, []);

      // ✅ 处理导航点击（优化：防抖 + 清理timeout）
      const handleNavClick = React.useCallback((e: React.MouseEvent) => {
        const now = Date.now();
        // 防抖：150ms内的重复点击直接忽略
        if (now - lastClickTimeRef.current < 150) {
          e.preventDefault();
          return;
        }
        lastClickTimeRef.current = now;

        // 清除之前的timeout
        if (navTimeoutRef.current) {
          clearTimeout(navTimeoutRef.current);
        }

        setIsNavigating(true);
        // 使用ref存储timeout ID
        navTimeoutRef.current = window.setTimeout(() => {
          setIsNavigating(false);
          navTimeoutRef.current = null;
        }, 200);
      }, []);

      // ✅ 处理子菜单导航（折叠状态下，优化防抖 + timeout管理）
      const handleSubMenuNavClick = React.useCallback(() => {
        if (isCollapsed) {
          const now = Date.now();
          // 防抖：150ms内的重复点击直接忽略
          if (now - lastClickTimeRef.current < 150) {
            return;
          }
          lastClickTimeRef.current = now;

          // 清除之前的timeout
          if (navTimeoutRef.current) {
            clearTimeout(navTimeoutRef.current);
          }

          setIsNavigating(true);

          // 使用startTransition优化路由切换
          startTransition(() => {
            router.push(item.href);
          });

          navTimeoutRef.current = window.setTimeout(() => {
            setIsNavigating(false);
            navTimeoutRef.current = null;
          }, 200);
        } else {
          setIsExpanded(!isExpanded);
        }
      }, [isCollapsed, isExpanded, router, item.href]);

      // 如果没有子菜单，渲染普通导航项
      if (!item.children || item.children.length === 0) {
        return (
          <Link
            href={item.href}
            ref={ref}
            tabIndex={tabIndex}
            prefetch={false}
            onClick={handleNavClick}
            className={cn(
              'block rounded-md transition-all duration-150',
              isFocused && 'ring-ring ring-2 ring-offset-2',
              isNavigating && 'opacity-70' // ✅ 导航时的视觉反馈
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
              disabled={item.disabled || isNavigating}
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
          <Button
            variant={isActive || hasActiveChild ? 'secondary' : 'ghost'}
            className={cn(
              'group h-10 w-full justify-start transition-all duration-150',
              isCollapsed ? 'px-2' : 'px-3',
              (isActive || hasActiveChild) &&
                'bg-secondary font-medium shadow-xs',
              'hover:bg-accent/50',
              isFocused && 'ring-ring ring-2 ring-offset-2',
              isNavigating && 'cursor-wait opacity-70' // ✅ 导航时的视觉反馈
            )}
            disabled={item.disabled || isNavigating}
            onClick={handleSubMenuNavClick}
            aria-label={item.title}
            title={isCollapsed ? item.title : undefined}
            tabIndex={tabIndex}
          >
            <Icon
              className={cn(
                'h-4 w-4 transition-transform duration-150',
                !isCollapsed && 'mr-3'
              )}
            />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">{item.title}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-150',
                    isExpanded && 'rotate-180'
                  )}
                />
              </>
            )}
          </Button>

          {/* 子菜单 */}
          {!isCollapsed && isExpanded && (
            <ChildMenuList pathname={pathname}>{item.children}</ChildMenuList>
          )}
        </div>
      );
    }
  )
);

SidebarNavItem.displayName = 'SidebarNavItem';
