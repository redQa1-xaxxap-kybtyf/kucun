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

import { Filter, Loader2, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import * as React from 'react';

import {
  UnifiedSearchBar,
  type ActionButton,
  type FilterConfig,
  type ToggleButton,
} from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const DateRangePicker = dynamic(
  () =>
    import('@/components/ui/date-range-picker').then(
      mod => mod.DateRangePicker
    ),
  { ssr: false, loading: () => null }
);

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

function formatDateRangeSummary(
  value?: DateRangeValue,
  fallbackLabel = '日期'
): string {
  const start = value?.startDate;
  const end = value?.endDate;

  if (start && end) {
    return `${start} 至 ${end}`;
  }

  if (start) {
    return `${fallbackLabel}从 ${start}`;
  }

  if (end) {
    return `${fallbackLabel}到 ${end}`;
  }

  return '';
}

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
    hasActiveFilters,
    className,
    compact = false,
    variant = 'default',
  }) => {
    const isPro = variant === 'pro';
    const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

    // 计算是否有活跃的筛选条件
    const hasFilters = React.useMemo(() => {
      if (hasActiveFilters !== undefined) {
        return hasActiveFilters;
      }

      if (searchValue && searchValue.trim()) {
        return true;
      }

      const hasFilterValues = filters.some(filter => {
        const value = filterValues[filter.key];
        const defaultValue =
          filter.defaultValue ??
          ((filter.includeAllOption ?? true) ? 'all' : undefined);

        return (
          value !== undefined &&
          value !== '' &&
          value !== defaultValue &&
          value !== 'all'
        );
      });
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

    const activeFilterItems = React.useMemo(() => {
      const items: Array<{ key: string; label: string; value: string }> = [];

      filters.forEach(filter => {
        const rawValue = filterValues[filter.key];
        const defaultValue =
          filter.defaultValue ??
          ((filter.includeAllOption ?? true) ? 'all' : undefined);

        if (
          rawValue === undefined ||
          rawValue === '' ||
          rawValue === 'all' ||
          rawValue === defaultValue
        ) {
          return;
        }

        const matchedOption = filter.options.find(
          option => option.value === rawValue
        );

        items.push({
          key: filter.key,
          label: filter.label,
          value: matchedOption?.label ?? rawValue,
        });
      });

      const dateRangeSummary = formatDateRangeSummary(
        dateRangeFilter?.value,
        dateRangeFilter?.label
      );

      if (dateRangeFilter && dateRangeSummary) {
        items.push({
          key: dateRangeFilter.key,
          label: dateRangeFilter.label || '日期',
          value: dateRangeSummary,
        });
      }

      return items;
    }, [dateRangeFilter, filterValues, filters]);

    const canOpenMobileFilters = Boolean(
      filters.length || dateRangeFilter || customFilters
    );
    const mobileActionColumns =
      actionButtons.length >= 2 ? 'grid-cols-2' : 'grid-cols-1';

    return (
      <Card
        className={cn(CARD_VARIANTS[variant], isPro ? 'p-1' : '', className)}
      >
        <CardContent
          className={cn(
            isPro ? 'bg-transparent p-6' : 'bg-[hsl(var(--color-bg-card))] pt-6'
          )}
        >
          {!isPro && (
            <div className="mb-3 hidden items-center gap-2 sm:flex">
              <Filter className="h-4 w-4 text-[hsl(var(--color-primary))]" />
              <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                筛选条件
              </span>
            </div>
          )}

          <div className="space-y-3 sm:hidden">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                {isSearching ? (
                  <Loader2 className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin" />
                ) : (
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                )}
                <Input
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={event => onSearchChange(event.target.value)}
                  className={cn(
                    'h-11 rounded-xl pl-10',
                    searchValue && 'pr-10',
                    isPro &&
                      'border-white bg-white/40 font-bold backdrop-blur-md'
                  )}
                />
                {searchValue && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSearchChange('')}
                    className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 p-0"
                    aria-label="清空搜索"
                  >
                    <X className="text-muted-foreground h-4 w-4" />
                  </Button>
                )}
              </div>

              {canOpenMobileFilters && (
                <Sheet
                  open={mobileFiltersOpen}
                  onOpenChange={setMobileFiltersOpen}
                >
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant={activeFilterItems.length > 0 ? 'default' : 'outline'}
                      className="h-11 shrink-0 rounded-xl px-3"
                    >
                      <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                      {activeFilterItems.length > 0
                        ? `筛选(${activeFilterItems.length})`
                        : '筛选'}
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 pb-6"
                  >
                    <SheetHeader>
                      <SheetTitle>筛选条件</SheetTitle>
                      <SheetDescription>
                        只保留手机上常用的搜索和筛选入口，减少首屏占用。
                      </SheetDescription>
                    </SheetHeader>

                    <div className="mt-5 space-y-4">
                      {filters.map(filter => {
                        const includeAllOption = filter.includeAllOption ?? true;
                        const selectedValue =
                          filterValues[filter.key] ??
                          filter.defaultValue ??
                          (includeAllOption ? 'all' : '');

                        return (
                          <div key={filter.key} className="space-y-2">
                            <label className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                              {filter.label}
                            </label>
                            <select
                              aria-label={filter.label}
                              value={selectedValue}
                              onChange={event => {
                                if (!onFilterChange) {
                                  return;
                                }

                                const nextValue = event.target.value;
                                const shouldReset =
                                  nextValue === '' ||
                                  (includeAllOption && nextValue === 'all') ||
                                  (filter.defaultValue !== undefined &&
                                    nextValue === filter.defaultValue);

                                onFilterChange(
                                  filter.key,
                                  shouldReset ? undefined : nextValue
                                );
                              }}
                              className="border-input bg-background ring-offset-background focus:ring-ring h-11 w-full rounded-xl border px-3 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
                            >
                              {includeAllOption ? (
                                <option value="all">全部{filter.label}</option>
                              ) : (
                                <option value="">
                                  {filter.placeholder || filter.label}
                                </option>
                              )}
                              {filter.options.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}

                      {dateRangeFilter && (
                        <div className="space-y-2">
                          {dateRangeFilter.label && (
                            <label className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                              {dateRangeFilter.label}
                            </label>
                          )}
                          <DateRangePicker
                            value={dateRangeFilter.value}
                            onChange={dateRangeFilter.onChange}
                            label=""
                            placeholder={
                              dateRangeFilter.placeholder || '选择日期范围'
                            }
                            showPresets={dateRangeFilter.showPresets ?? true}
                            className={cn('w-full', dateRangeFilter.className)}
                          />
                        </div>
                      )}

                      {customFilters && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                            其他筛选
                          </div>
                          <div>{customFilters}</div>
                        </div>
                      )}
                    </div>

                    <div className="sticky bottom-0 mt-6 flex gap-2 border-t bg-white/95 pt-4 backdrop-blur">
                      {showClearButton && hasFilters && onClearFilters && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearFilters}
                          className="flex-1"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          重置
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => setMobileFiltersOpen(false)}
                        className={cn(
                          showClearButton && hasFilters && onClearFilters
                            ? 'flex-1'
                            : 'w-full'
                        )}
                      >
                        完成
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>

            {toggleButtons.length > 0 && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {toggleButtons.map(toggle => (
                  <Button
                    key={toggle.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    data-active={toggle.active || undefined}
                    className="h-9 shrink-0 rounded-xl data-[active=true]:border-[hsl(var(--color-primary))] data-[active=true]:bg-[hsl(var(--color-primary-light))] data-[active=true]:text-[hsl(var(--color-primary))]"
                    onClick={toggle.onClick}
                  >
                    {toggle.icon}
                    <span className="text-xs">{toggle.label}</span>
                  </Button>
                ))}
              </div>
            )}

            {actionButtons.length > 0 && (
              <div className={cn('grid gap-2', mobileActionColumns)}>
                {actionButtons.map((action, index) => (
                  <Button
                    key={action.key || action.label || `mobile-action-${index}`}
                    type="button"
                    variant={action.variant || 'default'}
                    className={cn(
                      'h-11 w-full justify-center rounded-xl',
                      action.className
                    )}
                    onClick={action.onClick}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            {activeFilterItems.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFilterItems.map(item => (
                  <span
                    key={item.key}
                    className="inline-flex max-w-full items-center rounded-full bg-[hsl(var(--color-bg-tertiary))] px-3 py-1 text-xs text-[hsl(var(--color-text-secondary))]"
                  >
                    <span className="mr-1 shrink-0 font-medium text-[hsl(var(--color-text-primary))]">
                      {item.label}:
                    </span>
                    <span className="truncate">{item.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="hidden sm:block">
            <div className="flex flex-wrap items-end gap-3 sm:gap-4">
              <div className="flex min-w-0 w-full flex-1 flex-col gap-1.5 sm:min-w-[300px]">
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
                  className={isPro ? 'w-full' : ''}
                  // @ts-ignore - 传递 PRO 样式标识
                  variant={isPro ? 'pro' : 'default'}
                />
              </div>

              {dateRangeFilter && (
                <DateRangePicker
                  value={dateRangeFilter.value}
                  onChange={dateRangeFilter.onChange}
                  label={isPro ? undefined : dateRangeFilter.label}
                  placeholder={dateRangeFilter.placeholder || '选择日期范围'}
                  showPresets={dateRangeFilter.showPresets ?? true}
                  className={cn(
                    'min-w-0 w-full sm:min-w-[200px] sm:w-auto',
                    isPro
                      ? 'h-14 rounded-2xl border-white bg-white/40 font-bold backdrop-blur-md'
                      : '',
                    dateRangeFilter.className
                  )}
                />
              )}

              {customFilters && (
                <div className="w-full sm:w-auto">{customFilters}</div>
              )}

              {showClearButton && hasFilters && onClearFilters && (
                <Button
                  variant={isPro ? 'ghost' : 'outline'}
                  size="sm"
                  onClick={handleClearFilters}
                  className={cn(
                    'h-8 w-full justify-center gap-1.5 self-end transition-all sm:w-auto',
                    isPro
                      ? 'font-black text-slate-400 hover:bg-white/50 hover:text-slate-900'
                      : 'hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))]'
                  )}
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  重置筛选
                </Button>
              )}
            </div>
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
  ToggleButton,
} from '@/components/common/unified-search-bar';
