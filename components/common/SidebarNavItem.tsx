'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { NavigationItem } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

export const buildNavItemKey = (
  parentKey: string | undefined,
  item: NavigationItem,
  fallbackIndex?: number
): string => {
  const baseKey =
    item.id ?? item.href ?? `${item.title}-${fallbackIndex ?? 'unknown'}`;
  const indexSuffix =
    typeof fallbackIndex === 'number' ? `::${fallbackIndex}` : '';
  const computedKey = `${baseKey}${indexSuffix}`;
  return parentKey ? `${parentKey}::${computedKey}` : computedKey;
};

/**
 * 子菜单项组件（支持三级菜单）
 */
interface SubMenuItemProps {
  item: NavigationItem;
  pathname: string;
  isActive: boolean;
  level: number;
  nodeKey: string;
}

const SubMenuItem = React.memo(
  ({ item, pathname, isActive, level, nodeKey }: SubMenuItemProps) => {
    const Icon = item.icon;
    const [isExpanded, setIsExpanded] = React.useState(false);

    // 检查是否有子菜单
    const hasChildren = item.children && item.children.length > 0;

    // 检查是否有激活的子菜单项
    const hasActiveChild = React.useMemo(
      () =>
        item.children?.some(
          child =>
            pathname === child.href || pathname.startsWith(`${child.href}/`)
        ) ?? false,
      [item.children, pathname]
    );

    // 如果有激活的子菜单项，自动展开
    React.useEffect(() => {
      if (hasActiveChild) {
        setIsExpanded(true);
      }
    }, [hasActiveChild]);

    // 处理子菜单展开/收起
    const handleToggle = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded(prev => !prev);
    }, []);

    // 计算缩进（每级增加 12px）
    const indentClass = level === 2 ? 'ml-0' : `ml-${(level - 2) * 3}`;

    // 如果没有子菜单，渲染普通链接
    if (!hasChildren) {
      return (
        <Link
          href={item.href}
          prefetch={false}
          className="block rounded-md transition-all duration-150"
        >
          <Button
            variant="ghost"
            className={cn(
              'group relative h-9 w-full justify-start rounded-md px-3 text-sm font-medium transition-colors duration-150',
              indentClass,
              'text-[hsl(var(--sidebar-text-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-hover-foreground))]',
              'focus-visible:ring-[hsl(var(--sidebar-focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar-bg))]',
              'disabled:opacity-60',
              isActive &&
                'bg-[hsl(var(--sidebar-sub-active))] text-[hsl(var(--sidebar-hover-foreground))] shadow-sm before:absolute before:top-1/2 before:left-0 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-[hsl(var(--sidebar-active-indicator))] before:content-[""]'
            )}
            disabled={item.disabled}
            asChild
          >
            <div className="flex items-center">
              {Icon && (
                <Icon
                  className={cn(
                    'mr-3 h-3.5 w-3.5 text-[hsl(var(--sidebar-icon-muted))] transition-colors duration-150',
                    'group-hover:text-[hsl(var(--sidebar-hover-foreground))]',
                    isActive && 'text-[hsl(var(--sidebar-hover-foreground))]'
                  )}
                />
              )}
              <span className="flex-1 text-left">{item.title}</span>
            </div>
          </Button>
        </Link>
      );
    }

    // 渲染带子菜单的项（三级菜单）
    return (
      <div className="space-y-1">
        <Button
          variant="ghost"
          className={cn(
            'group relative h-9 w-full justify-start rounded-md px-3 text-sm font-medium transition-colors duration-150',
            indentClass,
            'text-[hsl(var(--sidebar-text-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-hover-foreground))]',
            'focus-visible:ring-[hsl(var(--sidebar-focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar-bg))]',
            'disabled:opacity-60',
            (isActive || hasActiveChild) &&
              'bg-[hsl(var(--sidebar-sub-active))] text-[hsl(var(--sidebar-hover-foreground))] shadow-sm'
          )}
          disabled={item.disabled}
          onClick={handleToggle}
          aria-expanded={isExpanded}
        >
          {Icon && (
            <Icon
              className={cn(
                'mr-3 h-3.5 w-3.5 text-[hsl(var(--sidebar-icon-muted))] transition-colors duration-150',
                'group-hover:text-[hsl(var(--sidebar-hover-foreground))]',
                (isActive || hasActiveChild) &&
                  'text-[hsl(var(--sidebar-hover-foreground))]'
              )}
            />
          )}
          <span className="flex-1 text-left">{item.title}</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-[hsl(var(--sidebar-text-tertiary))] transition-transform duration-150',
              (isActive || hasActiveChild) &&
                'text-[hsl(var(--sidebar-hover-foreground))]',
              isExpanded && 'rotate-180'
            )}
          />
        </Button>

        {/* 递归渲染子菜单 */}
        {isExpanded && (
          <div className="ml-3 space-y-1">
            {item.children?.map((child, index) => {
              const isChildActive =
                pathname === child.href ||
                pathname.startsWith(`${child.href}/`);
              const childKey = buildNavItemKey(nodeKey, child, index);
              return (
                <SubMenuItem
                  key={childKey}
                  item={child}
                  pathname={pathname}
                  isActive={isChildActive}
                  level={level + 1}
                  nodeKey={childKey}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

SubMenuItem.displayName = 'SubMenuItem';

/**
 * 子菜单列表组件（优化：接收 pathname 作为 prop，避免重复订阅路由）
 */
interface ChildMenuListProps {
  items: NavigationItem[];
  pathname: string;
  parentKey: string;
}

const ChildMenuList = React.memo(
  ({ items, pathname, parentKey }: ChildMenuListProps) => {
    // 找到最佳匹配的子菜单（最长路径匹配）
    const bestMatch = React.useMemo(
      () =>
        items
          .filter(
            child =>
              pathname === child.href || pathname.startsWith(`${child.href}/`)
          )
          .sort((a, b) => b.href.length - a.href.length)[0],
      [items, pathname]
    );

    return (
      <div className="mt-2 ml-3 space-y-1 rounded-md border border-[hsl(var(--sidebar-subtle-border))] bg-[hsl(var(--sidebar-subtle-bg))] p-2">
        {items.map((child, index) => {
          const isChildActive = bestMatch?.id === child.id;
          const childKey = buildNavItemKey(parentKey, child, index);

          return (
            <SubMenuItem
              key={childKey}
              item={child}
              pathname={pathname}
              isActive={isChildActive}
              level={2}
              nodeKey={childKey}
            />
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
  nodeKey: string;
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
      {
        item,
        pathname,
        isActive,
        isCollapsed,
        isFocused = false,
        tabIndex,
        nodeKey,
      },
      ref
    ) => {
      const Icon = item.icon;
      const [isExpanded, setIsExpanded] = React.useState(false);

      // ✅ 检查是否有子菜单项处于激活状态（使用 useMemo 优化）
      const hasActiveChild = React.useMemo(
        () =>
          item.children?.some(
            child =>
              (pathname === child.href ||
                pathname.startsWith(`${child.href}/`)) &&
              child.href !== item.href
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
              isFocused &&
                'ring-2 ring-[hsl(var(--sidebar-focus-ring))] ring-offset-2 ring-offset-[hsl(var(--sidebar-bg))]'
            )}
            aria-label={item.title}
            title={isCollapsed ? item.title : undefined}
          >
            <Button
              variant="ghost"
              className={cn(
                'group relative inline-flex h-10 w-full items-center justify-start rounded-md text-sm font-medium transition-colors duration-150',
                isCollapsed ? 'px-2' : 'px-3',
                'text-[hsl(var(--sidebar-text-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-hover-foreground))]',
                'focus-visible:ring-[hsl(var(--sidebar-focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar-bg))]',
                'disabled:opacity-60',
                isActive &&
                  'bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-active-foreground))] shadow-sm before:absolute before:top-1/2 before:left-0 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-[hsl(var(--sidebar-active-indicator))] before:content-[""]'
              )}
              disabled={item.disabled}
              asChild
            >
              <div className="flex items-center">
                {Icon && (
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors duration-150',
                      !isCollapsed && 'mr-3',
                      'text-[hsl(var(--sidebar-icon-muted))] group-hover:text-[hsl(var(--sidebar-hover-foreground))]',
                      isActive && 'text-[hsl(var(--sidebar-icon-active))]'
                    )}
                  />
                )}
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
                isFocused &&
                  'ring-2 ring-[hsl(var(--sidebar-focus-ring))] ring-offset-2 ring-offset-[hsl(var(--sidebar-bg))]'
              )}
              aria-label={item.title}
              title={item.title}
            >
              <Button
                variant="ghost"
                className={cn(
                  'group relative inline-flex h-10 w-full items-center justify-start rounded-md text-sm font-medium transition-colors duration-150',
                  'px-2',
                  'text-[hsl(var(--sidebar-text-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-hover-foreground))]',
                  'focus-visible:ring-[hsl(var(--sidebar-focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar-bg))]',
                  'disabled:opacity-60',
                  (isActive || hasActiveChild) &&
                    'bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-active-foreground))] shadow-sm before:absolute before:top-1/2 before:left-0 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-[hsl(var(--sidebar-active-indicator))] before:content-[""]'
                )}
                disabled={item.disabled}
                asChild
              >
                <div className="flex items-center justify-center">
                  {Icon && (
                    <Icon
                      className={cn(
                        'h-4 w-4 transition-colors duration-150',
                        'text-[hsl(var(--sidebar-icon-muted))] group-hover:text-[hsl(var(--sidebar-hover-foreground))]',
                        (isActive || hasActiveChild) &&
                          'text-[hsl(var(--sidebar-icon-active))]'
                      )}
                    />
                  )}
                </div>
              </Button>
            </Link>
          ) : (
            /* 展开状态下，父菜单用于切换子菜单显示 */
            <div>
              <Button
                variant="ghost"
                className={cn(
                  'group relative inline-flex h-10 w-full items-center justify-start rounded-md text-sm font-medium transition-colors duration-150',
                  'px-3',
                  'text-[hsl(var(--sidebar-text-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-hover-foreground))]',
                  'focus-visible:ring-[hsl(var(--sidebar-focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar-bg))]',
                  'disabled:opacity-60',
                  (isActive || hasActiveChild) &&
                    'bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-active-foreground))] shadow-sm before:absolute before:top-1/2 before:left-0 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-[hsl(var(--sidebar-active-indicator))] before:content-[""]',
                  isFocused &&
                    'ring-2 ring-[hsl(var(--sidebar-focus-ring))] ring-offset-2 ring-offset-[hsl(var(--sidebar-bg))]'
                )}
                disabled={item.disabled}
                onClick={handleSubMenuToggle}
                aria-label={item.title}
                aria-expanded={isExpanded}
                tabIndex={tabIndex}
              >
                <div className="flex w-full items-center">
                  {Icon && (
                    <Icon
                      className={cn(
                        'mr-3 h-4 w-4 transition-colors duration-150',
                        'text-[hsl(var(--sidebar-icon-muted))] group-hover:text-[hsl(var(--sidebar-hover-foreground))]',
                        (isActive || hasActiveChild) &&
                          'text-[hsl(var(--sidebar-icon-active))]'
                      )}
                    />
                  )}
                  <span className="flex-1 text-left">{item.title}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-[hsl(var(--sidebar-text-tertiary))] transition-transform duration-150',
                      (isActive || hasActiveChild) &&
                        'text-[hsl(var(--sidebar-icon-active))]',
                      isExpanded &&
                        'rotate-180 text-[hsl(var(--sidebar-hover-foreground))]'
                    )}
                  />
                </div>
              </Button>

              {/* 子菜单 */}
              {isExpanded && (
                <ChildMenuList
                  pathname={pathname}
                  items={item.children ?? []}
                  parentKey={nodeKey}
                />
              )}
            </div>
          )}
        </div>
      );
    }
  )
);

SidebarNavItem.displayName = 'SidebarNavItem';
