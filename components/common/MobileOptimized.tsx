'use client';

import {
  ChevronLeft,
  Filter,
  Grid3X3,
  List,
  MoreHorizontal,
  Search,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

/**
 * 移动端优化的卡片组件
 * 提供更适合触摸操作的界面
 */
interface MobileCardProps {
  title: string;
  description?: string;
  value?: string | number;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function MobileCard({
  title,
  description,
  value,
  badge,
  badgeVariant = 'secondary',
  icon,
  onClick,
  className,
  children,
}: MobileCardProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md active:scale-95',
        isMobile && 'touch-manipulation',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className={cn('pb-3', isMobile && 'p-4')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {icon && (
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                {icon}
              </div>
            )}
            <div>
              <CardTitle className={cn('text-base', isMobile && 'text-sm')}>
                {title}
              </CardTitle>
              {description && (
                <CardDescription
                  className={cn('text-sm', isMobile && 'text-xs')}
                >
                  {description}
                </CardDescription>
              )}
            </div>
          </div>

          {badge && (
            <Badge variant={badgeVariant} className={cn(isMobile && 'text-xs')}>
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>

      {(value || children) && (
        <CardContent className={cn('pt-0', isMobile && 'p-4 pt-0')}>
          {value && (
            <div className={cn('text-2xl font-bold', isMobile && 'text-xl')}>
              {value}
            </div>
          )}
          {children}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * 移动端优化的列表组件
 * 支持滑动操作和触摸友好的交互
 */
interface MobileListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onItemClick?: (item: T, index: number) => void;
  onItemSwipe?: (item: T, index: number, direction: 'left' | 'right') => void;
  className?: string;
  emptyMessage?: string;
}

export function MobileList<T>({
  items,
  renderItem,
  onItemClick,
  onItemSwipe,
  className,
  emptyMessage = '暂无数据',
}: MobileListProps<T>) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [swipeStates, setSwipeStates] = React.useState<
    Record<
      number,
      {
        startX: number;
        currentX: number;
        isSwiping: boolean;
      }
    >
  >({});

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    if (!isMobile || !onItemSwipe) return;

    const touch = e.touches[0];
    setSwipeStates(prev => ({
      ...prev,
      [index]: {
        startX: touch.clientX,
        currentX: touch.clientX,
        isSwiping: false,
      },
    }));
  };

  const handleTouchMove = (e: React.TouchEvent, index: number) => {
    if (!isMobile || !onItemSwipe) return;

    const touch = e.touches[0];
    const state = swipeStates[index];
    if (!state) return;

    setSwipeStates(prev => ({
      ...prev,
      [index]: {
        ...state,
        currentX: touch.clientX,
        isSwiping: Math.abs(touch.clientX - state.startX) > 10,
      },
    }));
  };

  const handleTouchEnd = (item: T, index: number) => {
    if (!isMobile || !onItemSwipe) return;

    const state = swipeStates[index];
    if (!state) return;

    const distance = state.currentX - state.startX;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      const direction = distance > 0 ? 'right' : 'left';
      onItemSwipe(item, index, direction);
    }

    // 清除滑动状态
    setSwipeStates(prev => {
      const newStates = { ...prev };
      delete newStates[index];
      return newStates;
    });
  };

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, index) => {
        const swipeState = swipeStates[index];
        const translateX = swipeState
          ? swipeState.currentX - swipeState.startX
          : 0;

        return (
          <div
            key={index}
            className={cn(
              'transition-transform duration-200',
              onItemClick && 'cursor-pointer',
              isMobile && 'touch-manipulation'
            )}
            style={{
              transform: swipeState?.isSwiping
                ? `translateX(${translateX}px)`
                : undefined,
            }}
            onClick={() => onItemClick?.(item, index)}
            onTouchStart={e => handleTouchStart(e, index)}
            onTouchMove={e => handleTouchMove(e, index)}
            onTouchEnd={() => handleTouchEnd(item, index)}
          >
            {renderItem(item, index)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 移动端优化的工具栏组件
 * 提供常用操作的快速访问
 */
interface MobileToolbarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  }>;
  className?: string;
}

export function MobileToolbar({
  title,
  showBack = false,
  onBack,
  actions = [],
  className,
}: MobileToolbarProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        isMobile && 'sticky top-0 z-40',
        className
      )}
    >
      <div className="flex items-center space-x-3">
        {showBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {title && (
          <h1 className={cn('font-semibold', isMobile ? 'text-lg' : 'text-xl')}>
            {title}
          </h1>
        )}
      </div>

      {actions.length > 0 && (
        <div className="flex items-center space-x-2">
          {actions.slice(0, isMobile ? 2 : 4).map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'ghost'}
              size="sm"
              onClick={action.onClick}
              className={cn('p-2', isMobile && 'touch-manipulation')}
              title={action.label}
            >
              {action.icon}
              {!isMobile && (
                <span className="ml-2 text-sm">{action.label}</span>
              )}
            </Button>
          ))}

          {actions.length > (isMobile ? 2 : 4) && (
            <Button variant="ghost" size="sm" className="p-2">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 移动端优化的视图切换组件
 * 支持网格和列表视图切换
 */
interface MobileViewSwitcherProps {
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
  showFilter?: boolean;
  onFilter?: () => void;
  showSearch?: boolean;
  onSearch?: () => void;
  className?: string;
}

export function MobileViewSwitcher({
  view,
  onViewChange,
  showFilter = false,
  onFilter,
  showSearch = false,
  onSearch,
  className,
}: MobileViewSwitcherProps) {
  const _isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b p-4',
        className
      )}
    >
      <div className="flex items-center space-x-2">
        {showSearch && (
          <Button variant="ghost" size="sm" onClick={onSearch} className="p-2">
            <Search className="h-4 w-4" />
          </Button>
        )}

        {showFilter && (
          <Button variant="ghost" size="sm" onClick={onFilter} className="p-2">
            <Filter className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
        <Button
          variant={view === 'grid' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('grid')}
          className="p-2"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>

        <Button
          variant={view === 'list' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('list')}
          className="p-2"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * 移动端优化的底部操作栏
 * 提供主要操作的快速访问
 */
interface MobileBottomBarProps {
  actions: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    disabled?: boolean;
  }>;
  className?: string;
}

export function MobileBottomBar({ actions, className }: MobileBottomBarProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (!isMobile || actions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
    >
      <div className="flex items-center justify-around space-x-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || 'default'}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className="h-auto flex-1 touch-manipulation flex-col space-y-1 py-3"
          >
            {action.icon}
            <span className="text-xs">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
