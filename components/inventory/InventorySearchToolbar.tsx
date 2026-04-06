/**
 * 库存搜索工具栏组件
 * 统一库存查询在桌面端和移动端的搜索、筛选与排序体验
 */

'use client';

import { AlertTriangle, Download, Package, Rows } from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type {
  ActionButton,
  FilterConfig,
} from '@/components/common/unified-search-bar';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import {
  buildInventorySortMode,
  DEFAULT_INVENTORY_SORT_MODE,
  INVENTORY_FILTER_CONFIG,
  INVENTORY_SEARCH_HINT,
  INVENTORY_SORT_MODE_OPTIONS,
  parseInventorySortMode,
} from '@/lib/configs/filter-configs';
import type { InventoryQueryParams } from '@/lib/types/inventory';

interface InventorySearchToolbarProps {
  queryParams: InventoryQueryParams;
  categoryOptions: Array<{ id: string; name: string }>;
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
            label: category.name,
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

    const sharedCardProps = {
      searchValue: searchValue ?? (queryParams.search || ''),
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
          className="sm:hidden"
          data-testid="inventory-mobile-search-toolbar"
        >
          <SearchFilterCard
            {...sharedCardProps}
            actionButtons={[]}
            variant="elevated"
            compact
            className="overflow-hidden rounded-2xl border border-[hsl(var(--color-border-primary))] bg-white shadow-sm"
          />
          <p className="px-1 pt-2 text-xs text-[hsl(var(--color-text-secondary))]">
            {INVENTORY_SEARCH_HINT}
          </p>
        </div>

        <div
          className="hidden sm:block"
          data-testid="inventory-desktop-search-toolbar"
        >
          <SearchFilterCard
            {...sharedCardProps}
            actionButtons={desktopActionButtons}
            variant="pro"
            compact
          />
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
