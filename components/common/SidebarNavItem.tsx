'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

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
  isPathActive: (href: string) => boolean;
  isActive: boolean;
  level: number;
  nodeKey: string;
}

const SubMenuItem = React.memo(
  ({ item, isPathActive, isActive, level, nodeKey }: SubMenuItemProps) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const hasChildren = item.children && item.children.length > 0;

    const hasActiveChild = React.useMemo(
      () => item.children?.some(child => isPathActive(child.href)) ?? false,
      [item.children, isPathActive]
    );

    React.useEffect(() => {
      if (hasActiveChild || isActive) {
        setIsExpanded(true);
      }
    }, [hasActiveChild, isActive]);

    const handleToggle = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded(prev => !prev);
    }, []);

    // 业务系统侧边栏：低干扰选中态，方便长时间扫菜单
    const itemClasses = cn(
      'group relative flex h-8 w-full items-center justify-start rounded-md px-3 text-[13px] font-medium transition-colors duration-150',
      isActive
        ? 'border border-blue-100 bg-blue-50 text-blue-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    );

    if (!hasChildren) {
      return (
        <Link href={item.href} prefetch={false} className={itemClasses}>
          <div className="flex items-center gap-3">
            {/* 活跃状态下的动态小圆点 */}
            <div
              className={cn(
                'h-1 w-1 rounded-full transition-all duration-300',
                isActive
                  ? 'scale-125 bg-blue-600'
                  : 'bg-slate-300 group-hover:bg-slate-500'
              )}
            />
            <span className="flex-1 text-left">{item.title}</span>
          </div>
        </Link>
      );
    }

    return (
      <div className="space-y-1">
        <button
          className={cn(
            itemClasses,
            (isActive || hasActiveChild) && 'bg-blue-50 text-blue-700'
          )}
          onClick={handleToggle}
          aria-expanded={isExpanded}
        >
          <div className="flex w-full items-center gap-3">
            <div
              className={cn(
                'h-1 w-1 rounded-full transition-all',
                isActive || hasActiveChild
                  ? 'scale-125 bg-blue-500'
                  : 'bg-slate-200'
              )}
            />
            <span className="flex-1 text-left">{item.title}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-300',
                isExpanded && 'rotate-180'
              )}
            />
          </div>
        </button>

        {isExpanded && (
          <div className="relative mt-1 ml-4 space-y-1 pl-4">
            {/* 垂直引导线 */}
            <div className="absolute top-0 bottom-4 left-[18px] w-px bg-slate-100" />
            {item.children?.map((child, index) => {
              const isChildActive = isPathActive(child.href);
              const childKey = buildNavItemKey(nodeKey, child, index);
              return (
                <SubMenuItem
                  key={childKey}
                  item={child}
                  isPathActive={isPathActive}
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

interface ChildMenuListProps {
  items: NavigationItem[];
  isPathActive: (href: string) => boolean;
  parentKey: string;
}

const ChildMenuList = React.memo(
  ({ items, isPathActive, parentKey }: ChildMenuListProps) => {
    const bestMatch = React.useMemo(
      () =>
        items
          .filter(child => isPathActive(child.href))
          .sort((a, b) => b.href.length - a.href.length)[0],
      [items, isPathActive]
    );

    return (
      <div className="relative mt-2 ml-4 space-y-1 pl-4">
        {/* 垂直引导线 */}
        <div className="absolute top-0 bottom-4 left-[6px] w-px bg-slate-100" />
        {items.map((child: NavigationItem, index) => {
          const isChildActive = bestMatch?.id === child.id;
          const childKey = buildNavItemKey(parentKey, child, index);

          return (
            <SubMenuItem
              key={childKey}
              item={child}
              isPathActive={isPathActive}
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
  isPathActive: (href: string) => boolean;
  isActive: boolean;
  isCollapsed: boolean;
  isFocused?: boolean;
  tabIndex?: number;
  nodeKey: string;
}

export const SidebarNavItem = React.memo(
  React.forwardRef<HTMLAnchorElement, SidebarNavItemProps>(
    (
      {
        item,
        isPathActive,
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

      const hasActiveChild = React.useMemo(
        () =>
          item.children?.some(
            child => isPathActive(child.href) && child.href !== item.href
          ) ?? false,
        [item.children, item.href, isPathActive]
      );

      React.useEffect(() => {
        if ((hasActiveChild || isActive) && !isCollapsed) {
          setIsExpanded(true);
        }
      }, [hasActiveChild, isActive, isCollapsed]);

      const handleSubMenuToggle = React.useCallback(() => {
        setIsExpanded(prev => !prev);
      }, []);

      // 业务系统侧边栏：表格式后台更适合克制的选中态
      const commonClasses = cn(
        'group relative flex w-full items-center rounded-md border border-transparent outline-none transition-colors duration-150',
        isCollapsed ? 'h-12 justify-center' : 'h-10 px-3 gap-3',
        isActive
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
        isFocused && 'ring-2 ring-blue-500/20 ring-offset-1'
      );

      if (!item.children || item.children.length === 0) {
        return (
          <Link
            href={item.href}
            ref={ref}
            tabIndex={tabIndex}
            prefetch={true}
            className={commonClasses}
            aria-label={item.title}
          >
            {Icon && (
              <Icon
                className={cn(
                  'transition-all duration-500',
                  isCollapsed ? 'h-6 w-6' : 'h-5 w-5',
                  isActive
                    ? 'text-blue-700'
                    : 'text-slate-500 group-hover:text-slate-900'
                )}
              />
            )}
            {!isCollapsed && (
              <span
                className={cn(
                  'flex-1 truncate text-left text-sm',
                  isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {item.title}
              </span>
            )}
          </Link>
        );
      }

      return (
        <div className="space-y-1">
          {isCollapsed ? (
            <Link
              href={item.href}
              prefetch={true}
              className={commonClasses}
              aria-label={item.title}
            >
              {Icon && (
                <Icon
                  className={cn(
                    'h-6 w-6 transition-all duration-500',
                    isActive || hasActiveChild
                      ? 'text-blue-700'
                      : 'text-slate-500 group-hover:text-slate-900'
                  )}
                />
              )}
            </Link>
          ) : (
            <div>
              <button
                className={cn(
                  commonClasses,
                  (isActive || hasActiveChild) &&
                    !isActive &&
                    'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100'
                )}
                onClick={handleSubMenuToggle}
                aria-label={item.title}
                aria-expanded={isExpanded}
                tabIndex={tabIndex}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-colors duration-150',
                      isActive || hasActiveChild
                        ? 'text-blue-700'
                        : 'text-slate-500 group-hover:text-slate-900'
                    )}
                  />
                )}
                <span
                  className={cn(
                    'flex-1 truncate text-left text-sm',
                    isActive || hasActiveChild ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {item.title}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-150',
                    isExpanded ? 'rotate-180 opacity-100' : 'opacity-40'
                  )}
                />
              </button>

              {isExpanded && (
                <ChildMenuList
                  isPathActive={isPathActive}
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
