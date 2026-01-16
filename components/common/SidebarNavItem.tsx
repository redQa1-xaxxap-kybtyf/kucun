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
      () =>
        item.children?.some(child => isPathActive(child.href)) ?? false,
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

    // v3 PRO 子菜单项样式
    const itemClasses = cn(
      'group relative flex h-9 w-full items-center justify-start rounded-xl px-4 text-[13px] font-bold transition-all duration-300 active:scale-95',
      isActive 
        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20' 
        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
    );

    if (!hasChildren) {
      return (
        <Link
          href={item.href}
          prefetch={false}
          className={itemClasses}
        >
          <div className="flex items-center gap-3">
             {/* 活跃状态下的动态小圆点 */}
             <div className={cn(
               "h-1 w-1 rounded-full transition-all duration-300",
               isActive ? "bg-white scale-125" : "bg-slate-200 group-hover:bg-slate-400"
             )} />
             <span className="flex-1 text-left">{item.title}</span>
          </div>
        </Link>
      );
    }

    return (
      <div className="space-y-1">
        <button
          className={cn(itemClasses, (isActive || hasActiveChild) && 'text-slate-900')}
          onClick={handleToggle}
          aria-expanded={isExpanded}
        >
          <div className="flex w-full items-center gap-3">
            <div className={cn(
               "h-1 w-1 rounded-full transition-all",
               (isActive || hasActiveChild) ? "bg-blue-500 scale-125" : "bg-slate-200"
            )} />
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
          <div className="relative ml-4 mt-1 space-y-1 pl-4">
             {/* 垂直引导线 */}
             <div className="absolute left-[18px] top-0 bottom-4 w-px bg-slate-100" />
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
          .filter(
            child =>
              isPathActive(child.href)
          )
          .sort((a, b) => b.href.length - a.href.length)[0],
      [items, isPathActive]
    );

    return (
      <div className="relative mt-2 ml-4 space-y-1 pl-4">
        {/* 垂直引导线 */}
        <div className="absolute left-[6px] top-0 bottom-4 w-px bg-slate-100" />
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
            child =>
              isPathActive(child.href) &&
              child.href !== item.href
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

      // v3 PRO 主导航项样式: Active Pill 2.0
      const commonClasses = cn(
        'group relative flex w-full items-center rounded-2xl transition-all duration-500 active:scale-95 outline-none',
        isCollapsed ? 'h-14 justify-center' : 'h-12 px-4 gap-4',
        isActive
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30'
          : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900',
        isFocused && 'ring-2 ring-blue-500/20 ring-offset-2'
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
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-900 group-hover:scale-110'
                )}
              />
            )}
            {!isCollapsed && (
              <span className={cn(
                "flex-1 text-sm text-left truncate",
                isActive ? "font-black" : "font-bold"
              )}>
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
                    isActive || hasActiveChild ? 'text-white' : 'text-slate-400 group-hover:text-slate-900 group-hover:scale-110'
                  )}
                />
              )}
            </Link>
          ) : (
            <div>
              <button
                className={cn(
                  commonClasses,
                  (isActive || hasActiveChild) && !isActive && 'bg-blue-50 text-blue-600 shadow-none border border-blue-100 hover:bg-blue-100'
                )}
                onClick={handleSubMenuToggle}
                aria-label={item.title}
                aria-expanded={isExpanded}
                tabIndex={tabIndex}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-all duration-500',
                      isActive || hasActiveChild ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'
                    )}
                  />
                )}
                <span className={cn(
                  "flex-1 text-sm text-left truncate",
                  isActive || hasActiveChild ? "font-black" : "font-bold"
                )}>
                  {item.title}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-all duration-500',
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
