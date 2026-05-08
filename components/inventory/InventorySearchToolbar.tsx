/**
 * 库存搜索工具栏组件
 * 统一库存查询在桌面端和移动端的搜索、筛选与排序体验
 */

'use client';

import {
  AlertTriangle,
  Download,
  Loader2,
  Package,
  Rows,
  Search,
  X,
} from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type {
  ActionButton,
  FilterConfig,
} from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import {
  buildInventorySortMode,
  DEFAULT_INVENTORY_SORT_MODE,
  INVENTORY_FILTER_CONFIG,
  INVENTORY_SEARCH_HINT,
  INVENTORY_SORT_MODE_OPTIONS,
  parseInventorySortMode,
} from '@/lib/configs/filter-configs';
import type { InventoryQueryParams } from '@/lib/types/inventory';
import { cn } from '@/lib/utils';

interface InventorySearchToolbarProps {
  queryParams: InventoryQueryParams;
  categoryOptions: Array<{
    id: string;
    name: string;
    fullPath?: string;
    level?: number;
  }>;
  searchValue?: string;
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
  onFilterPatch?: (updates: Partial<InventoryQueryParams>) => void;
  onClearFilters?: () => void;
  isSearching?: boolean;
  isExporting?: boolean;
  density: 'compact' | 'comfortable';
  onDensityChange: (density: 'compact' | 'comfortable') => void;
  onExport: () => void;
}

type ToolbarFilterValues = Record<
  'categoryId' | 'sortMode',
  string | undefined
>;

export const InventorySearchToolbar = React.memo<InventorySearchToolbarProps>(
  ({
    queryParams,
    categoryOptions,
    searchValue,
    onSearch,
    onFilter,
    onFilterPatch,
    onClearFilters,
    isSearching,
    isExporting = false,
    density,
    onDensityChange,
    onExport,
  }) => {
    const logic = useInventoryToolbarLogic({
      queryParams,
      onFilter,
      onFilterPatch,
      onClearFilters,
    });

    const toolbarFilters = React.useMemo<FilterConfig[]>(
      () => [
        {
          key: 'categoryId',
          label: '分类',
          options: categoryOptions.map(category => ({
            label: category.fullPath ?? category.name,
            value: category.id,
          })),
          width: 'w-[160px]',
        },
        {
          key: 'sortMode',
          label: '排序方式',
          options: INVENTORY_SORT_MODE_OPTIONS.map(option => ({
            label: option.label,
            value: option.value,
          })),
          width: 'w-[220px]',
          includeAllOption: false,
          defaultValue: DEFAULT_INVENTORY_SORT_MODE,
        },
      ],
      [categoryOptions]
    );

    const filterValues = React.useMemo<ToolbarFilterValues>(
      () => ({
        categoryId: queryParams.categoryId || 'all',
        sortMode: buildInventorySortMode(
          queryParams.sortBy || 'updatedAt',
          queryParams.sortOrder || 'desc'
        ),
      }),
      [queryParams.categoryId, queryParams.sortBy, queryParams.sortOrder]
    );

    const dateRangeFilter = React.useMemo(
      () => ({
        key: 'dateRange',
        label: INVENTORY_FILTER_CONFIG.dateRangeLabel,
        value: {
          startDate: queryParams.startDate,
          endDate: queryParams.endDate,
        },
        onChange: logic.handleDateRangeChange,
        placeholder: INVENTORY_FILTER_CONFIG.dateRangePlaceholder,
      }),
      [logic.handleDateRangeChange, queryParams.endDate, queryParams.startDate]
    );

    const toggleButtons = React.useMemo(
      () => [
        {
          key: 'lowStock',
          label: '库存偏低',
          icon: <AlertTriangle className="mr-1 h-3 w-3" />,
          active: !!queryParams.lowStock,
          onClick: logic.handleToggleLowStock,
        },
        {
          key: 'hasStock',
          label: '仅看有库存',
          icon: <Package className="mr-1 h-3 w-3" />,
          active: !!queryParams.hasStock,
          onClick: logic.handleToggleHasStock,
        },
      ],
      [
        logic.handleToggleHasStock,
        logic.handleToggleLowStock,
        queryParams.hasStock,
        queryParams.lowStock,
      ]
    );

    const desktopActionButtons = React.useMemo<ActionButton[]>(
      () => [
        {
          key: 'density',
          label: density === 'compact' ? '切换舒适' : '切换紧凑',
          icon: <Rows className="mr-1 h-3 w-3" />,
          onClick: () =>
            onDensityChange(density === 'compact' ? 'comfortable' : 'compact'),
          variant: 'outline',
        },
        {
          key: 'export',
          label: isExporting ? '导出中...' : '导出库存',
          icon: <Download className="mr-1 h-3 w-3" />,
          onClick: onExport,
          variant: 'outline',
          disabled: isExporting,
        },
      ],
      [density, isExporting, onDensityChange, onExport]
    );

    const desktopSearchValue = searchValue ?? (queryParams.search || '');

    const desktopFieldClassName =
      'h-10 w-full rounded-lg border border-[hsl(var(--color-border-primary))] bg-white px-3 text-sm font-normal text-[hsl(var(--color-text-primary))] transition-colors outline-hidden focus:border-[hsl(var(--color-primary))] focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2';

    const sharedCardProps = {
      searchValue: desktopSearchValue,
      onSearchChange: onSearch,
      searchPlaceholder: INVENTORY_FILTER_CONFIG.searchPlaceholder,
      isSearching,
      filters: toolbarFilters,
      filterValues,
      onFilterChange: logic.handleToolbarFilterChange,
      dateRangeFilter,
      toggleButtons,
      onClearFilters: logic.handleClearFilters,
      hasActiveFilters: logic.hasActiveFilters,
    } satisfies Omit<
      React.ComponentProps<typeof SearchFilterCard>,
      'actionButtons'
    >;

    return (
      <div className="space-y-3">
        <div
          className="sticky top-0 z-20 -mx-3 bg-[hsl(var(--color-bg-secondary))] px-3 pb-2 pt-2 sm:hidden"
          data-testid="inventory-mobile-search-toolbar"
        >
          <SearchFilterCard
            {...sharedCardProps}
            actionButtons={[]}
            variant="elevated"
            compact
            className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-white shadow-sm"
          />
          <p className="px-1 pt-2 text-xs text-[hsl(var(--color-text-secondary))]">
            {INVENTORY_SEARCH_HINT}
          </p>
        </div>

        <div
          className="hidden sm:block"
          data-testid="inventory-desktop-search-toolbar"
        >
          <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-white p-3 shadow-sm">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {desktopActionButtons.map((action, index) => (
                    <Button
                      key={action.key || action.label || `action-${index}`}
                      type="button"
                      variant={action.variant || 'outline'}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className={cn(
                        'h-10 rounded-lg px-3 font-medium',
                        action.className
                      )}
                    >
                      {action.icon}
                      {action.label}
                    </Button>
                  ))}
                </div>

                <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                  <div className="relative min-w-[260px] flex-1 xl:max-w-[480px]">
                    {isSearching ? (
                      <Loader2 className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin" />
                    ) : (
                      <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    )}
                    <Input
                      data-testid="inventory-desktop-search-input"
                      type="text"
                      inputMode="search"
                      enterKeyHint="search"
                      autoCapitalize="off"
                      autoCorrect="off"
                      placeholder={INVENTORY_FILTER_CONFIG.searchPlaceholder}
                      value={desktopSearchValue}
                      onChange={event => onSearch(event.target.value)}
                      className={cn(
                        desktopFieldClassName,
                        'w-full pl-10',
                        desktopSearchValue && 'pr-10'
                      )}
                    />
                    {desktopSearchValue ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 rounded-md p-0"
                        onClick={() => onSearch('')}
                        aria-label="清空库存搜索"
                      >
                        <X className="text-muted-foreground h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {toggleButtons.map(toggle => (
                      <Button
                        key={toggle.key}
                        type="button"
                        variant="outline"
                        data-active={toggle.active || undefined}
                        className="h-10 rounded-lg px-3 font-medium data-[active=true]:border-[hsl(var(--color-primary))] data-[active=true]:bg-[hsl(var(--color-primary-light))] data-[active=true]:text-[hsl(var(--color-primary))]"
                        onClick={toggle.onClick}
                      >
                        {toggle.icon}
                        {toggle.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-[minmax(260px,360px)_200px_minmax(360px,1fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <select
                    data-testid="inventory-desktop-category-filter"
                    aria-label="分类"
                    value={filterValues.categoryId || 'all'}
                    onChange={event =>
                      logic.handleToolbarFilterChange(
                        'categoryId',
                        event.target.value === 'all'
                          ? undefined
                          : event.target.value
                      )
                    }
                    className={desktopFieldClassName}
                  >
                    <option value="all">全部分类</option>
                    {categoryOptions.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.fullPath ?? category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <select
                    data-testid="inventory-desktop-sort-filter"
                    aria-label="排序"
                    value={filterValues.sortMode || DEFAULT_INVENTORY_SORT_MODE}
                    onChange={event =>
                      logic.handleToolbarFilterChange(
                        'sortMode',
                        event.target.value
                      )
                    }
                    className={desktopFieldClassName}
                  >
                    {INVENTORY_SORT_MODE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <DateRangePicker
                    value={dateRangeFilter.value}
                    onChange={dateRangeFilter.onChange}
                    label=""
                    placeholder={INVENTORY_FILTER_CONFIG.dateRangePlaceholder}
                    showPresets={true}
                    className="w-full"
                    triggerClassName={cn(
                      desktopFieldClassName,
                      'justify-start'
                    )}
                  />
                </div>

                {logic.hasActiveFilters ? (
                  <div className="lg:col-span-2 xl:col-span-1 xl:justify-self-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={logic.handleClearFilters}
                      className="h-10 rounded-lg px-3 text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-primary-light))]"
                    >
                      清空条件
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

InventorySearchToolbar.displayName = 'InventorySearchToolbar';

function useInventoryToolbarLogic({
  queryParams,
  onFilter,
  onFilterPatch,
  onClearFilters,
}: {
  queryParams: InventoryQueryParams;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
  onFilterPatch?: (updates: Partial<InventoryQueryParams>) => void;
  onClearFilters?: () => void;
}) {
  const handleToolbarFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'categoryId') {
        onFilter('categoryId', value);
        return;
      }

      if (key === 'sortMode') {
        const resolved = parseInventorySortMode(value);
        if (onFilterPatch) {
          onFilterPatch({
            sortBy: resolved.sortBy,
            sortOrder: resolved.sortOrder,
          });
          return;
        }

        onFilter('sortBy', resolved.sortBy);
        onFilter('sortOrder', resolved.sortOrder);
      }
    },
    [onFilter, onFilterPatch]
  );

  const handleToggleLowStock = React.useCallback(() => {
    onFilter('lowStock', !queryParams.lowStock);
  }, [onFilter, queryParams.lowStock]);

  const handleToggleHasStock = React.useCallback(() => {
    onFilter('hasStock', !queryParams.hasStock);
  }, [onFilter, queryParams.hasStock]);

  const handleClearFilters = React.useCallback(() => {
    if (onClearFilters) {
      onClearFilters();
      return;
    }

    if (onFilterPatch) {
      onFilterPatch({
        search: undefined,
        categoryId: undefined,
        lowStock: false,
        hasStock: false,
        startDate: undefined,
        endDate: undefined,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      return;
    }

    onFilter('search', undefined);
    onFilter('categoryId', undefined);
    onFilter('lowStock', false);
    onFilter('hasStock', false);
    onFilter('startDate', undefined);
    onFilter('endDate', undefined);
    onFilter('sortBy', 'updatedAt');
    onFilter('sortOrder', 'desc');
  }, [onClearFilters, onFilter, onFilterPatch]);

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      if (onFilterPatch) {
        onFilterPatch({
          startDate: range.startDate,
          endDate: range.endDate,
        });
        return;
      }

      onFilter('startDate', range.startDate);
      onFilter('endDate', range.endDate);
    },
    [onFilter, onFilterPatch]
  );

  const hasActiveFilters =
    !!queryParams.categoryId ||
    !!queryParams.lowStock ||
    !!queryParams.hasStock ||
    !!queryParams.startDate ||
    !!queryParams.endDate ||
    buildInventorySortMode(
      queryParams.sortBy || 'updatedAt',
      queryParams.sortOrder || 'desc'
    ) !== DEFAULT_INVENTORY_SORT_MODE ||
    !!(queryParams.search && queryParams.search.trim());

  return {
    handleToolbarFilterChange,
    handleToggleLowStock,
    handleToggleHasStock,
    handleClearFilters,
    handleDateRangeChange,
    hasActiveFilters,
  } as const;
}
