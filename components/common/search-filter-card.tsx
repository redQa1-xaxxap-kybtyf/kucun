'use client';

/**
 * 搜索筛选卡片组件
 * 统一的搜索筛选容器,包装 UnifiedSearchBar
 * 提供统一的样式和布局
 *
 * 功能特性:
 * - 统一的 Card 容器样式
 * - 支持日期范围筛选
 * - 支持清空筛选功能
 * - 响应式布局
 *
 * 遵循原则: KISS, DRY, SOLID
 */

import { Filter, RotateCcw } from 'lucide-react';
import * as React from 'react';

import {
    UnifiedSearchBar,
    type ActionButton,
    type FilterConfig,
    type ToggleButton,
} from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DateRangePicker,
    type DateRangeValue,
} from '@/components/ui/date-range-picker';
import { cn } from '@/lib/utils';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 日期范围筛选器配置
 */
export interface DateRangeFilterConfig {
  key: string;
  label?: string;
  value?: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  placeholder?: string;
  showPresets?: boolean;
  className?: string;
}

/**
 * 搜索筛选卡片属性
 */
export interface SearchFilterCardProps {
  // 搜索相关
  searchValue?: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string; // 搜索框标题标签
  isSearching?: boolean;

  // 筛选器
  filters?: FilterConfig[];
  filterValues?: Record<string, string | undefined>;
  onFilterChange?: (key: string, value: string | undefined) => void;

  // 日期范围筛选器
  dateRangeFilter?: DateRangeFilterConfig;

  // 自定义筛选器（例如：供应商选择器、客户选择器等）
  customFilters?: React.ReactNode;

  // 切换按钮
  toggleButtons?: ToggleButton[];

  // 操作按钮
  actionButtons?: ActionButton[];

  // 清空筛选
  onClearFilters?: () => void;
  showClearButton?: boolean;
  hasActiveFilters?: boolean;

  // 样式
  className?: string;
  compact?: boolean;

  // Card 样式变体
  variant?: 'default' | 'bordered' | 'elevated' | 'pro';
}

// ============================================================================
// 样式常量
// ============================================================================

const CARD_VARIANTS = {
  default: 'border border-[hsl(var(--color-border-secondary))]',
  bordered: 'border border-[hsl(var(--color-border-primary))]',
  elevated:
    'border border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-light)]',
  pro: 'border-white bg-white/60 backdrop-blur-xl shadow-sm rounded-[2.5rem]',
} as const;

// ============================================================================
// 组件实现
// ============================================================================

/**
 * 搜索筛选卡片组件
 */
export const SearchFilterCard = React.memo<SearchFilterCardProps>(
  ({
    searchValue = '',
    onSearchChange,
    searchPlaceholder = '搜索...',
    searchLabel = '搜索',
    isSearching = false,
    filters = [],
    filterValues = {},
    onFilterChange,
    dateRangeFilter,
    customFilters,
    toggleButtons = [],
    actionButtons = [],
    onClearFilters,
    showClearButton = true,
    hasActiveFilters = false,
    className,
    compact = false,
    variant = 'default',
  }) => {
    const isPro = variant === 'pro';

    // 计算是否有活跃的筛选条件
    const hasFilters = React.useMemo(() => {
      if (hasActiveFilters !== undefined) {
        return hasActiveFilters;
      }

      if (searchValue && searchValue.trim()) {
        return true;
      }

      const hasFilterValues = Object.values(filterValues).some(
        value => value !== undefined && value !== 'all'
      );
      if (hasFilterValues) {
        return true;
      }

      if (
        dateRangeFilter?.value?.startDate ||
        dateRangeFilter?.value?.endDate
      ) {
        return true;
      }

      return false;
    }, [hasActiveFilters, searchValue, filterValues, dateRangeFilter?.value]);

    const handleClearFilters = React.useCallback(() => {
      if (onClearFilters) {
        onClearFilters();
      }
    }, [onClearFilters]);

    return (
      <Card className={cn(CARD_VARIANTS[variant], isPro ? 'p-1' : '', className)}>
        <CardContent className={cn(
          isPro ? "bg-transparent p-6" : "bg-[hsl(var(--color-bg-card))] pt-6"
        )}>
          {/* 筛选条件标题 - Pro 模式下隐藏 */}
          {!isPro && (
            <div className="mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4 text-[hsl(var(--color-primary))]" />
              <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                筛选条件
              </span>
            </div>
          )}

          {/* 主搜索栏 */}
          <div className="flex flex-wrap items-end gap-4">
            {/* 搜索框 - Pro 模式下移除标签 */}
            <div className="flex flex-1 flex-col gap-1.5 min-w-[300px]">
              {!isPro && searchLabel && (
                <label className="text-muted-foreground text-xs font-medium">
                  {searchLabel}
                </label>
              )}
              <UnifiedSearchBar
                searchValue={searchValue}
                onSearchChange={onSearchChange}
                searchPlaceholder={searchPlaceholder}
                isSearching={isSearching}
                filters={filters}
                filterValues={filterValues}
                onFilterChange={onFilterChange}
                toggleButtons={toggleButtons}
                actionButtons={actionButtons}
                compact={compact}
                debounceDelay={0}
                className={isPro ? "w-full" : ""}
                // @ts-ignore - 传递 PRO 样式标识
                variant={isPro ? "pro" : "default"}
              />
            </div>

            {/* 日期范围筛选器 */}
            {dateRangeFilter && (
              <DateRangePicker
                value={dateRangeFilter.value}
                onChange={dateRangeFilter.onChange}
                label={isPro ? undefined : dateRangeFilter.label}
                placeholder={dateRangeFilter.placeholder || '选择日期范围'}
                showPresets={dateRangeFilter.showPresets ?? true}
                className={cn(
                  'min-w-[200px]', 
                  isPro ? "h-14 rounded-2xl border-white bg-white/40 font-bold backdrop-blur-md" : "",
                  dateRangeFilter.className
                )}
              />
            )}

            {/* 自定义筛选器 */}
            {customFilters && customFilters}

            {/* 重置筛选按钮 */}
            {showClearButton && hasFilters && onClearFilters && (
              <Button
                variant={isPro ? "ghost" : "outline"}
                size="sm"
                onClick={handleClearFilters}
                className={cn(
                  "h-8 gap-1.5 self-end transition-all",
                  isPro 
                    ? "font-black text-slate-400 hover:text-slate-900 hover:bg-white/50" 
                    : "hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))]"
                )}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                重置筛选
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

SearchFilterCard.displayName = 'SearchFilterCard';

// ============================================================================
// 导出类型
// ============================================================================

export type {
    ActionButton,
    FilterConfig,
    ToggleButton
} from '@/components/common/unified-search-bar';

