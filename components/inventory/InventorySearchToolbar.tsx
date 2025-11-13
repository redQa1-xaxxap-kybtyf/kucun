/**
 * 库存搜索工具栏组件
 * 包含搜索框、筛选器和操作按钮
 * ✅ 已迁移到使用 UnifiedSearchBar
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { AlertTriangle, Package } from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { INVENTORY_FILTER_CONFIG } from '@/lib/configs/filter-configs';
import type { InventoryQueryParams } from '@/lib/types/inventory';

interface InventorySearchToolbarProps {
  queryParams: InventoryQueryParams;
  categoryOptions: Array<{ id: string; name: string }>;
  /** ✅ 本地输入框值，提供即时UI反馈 */
  searchValue?: string;
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
  /** ✅ 新增：批量清空筛选回调 */
  onClearFilters?: () => void;
  /** ✅ 搜索状态指示（仅用于显示输入框内的加载图标） */
  isSearching?: boolean;
}

/**
 * 库存搜索工具栏组件
 * 使用统一搜索栏优化性能
 * 符合产品模块UI风格规范
 */
export const InventorySearchToolbar = React.memo<InventorySearchToolbarProps>(
  ({
    queryParams,
    categoryOptions,
    searchValue,
    onSearch,
    onFilter,
    onClearFilters,
    isSearching,
  }) => {
    const logic = useInventoryToolbarLogic({
      queryParams,
      onFilter,
      onClearFilters,
    });

    return (
      <InventoryToolbarView
        queryParams={queryParams}
        categoryOptions={categoryOptions}
        searchValue={searchValue}
        onSearch={onSearch}
        isSearching={isSearching}
        {...logic}
      />
    );
  }
);

InventorySearchToolbar.displayName = 'InventorySearchToolbar';

// 提取逻辑：回调与状态计算
function useInventoryToolbarLogic({
  queryParams,
  onFilter,
  onClearFilters,
}: {
  queryParams: InventoryQueryParams;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
  onClearFilters?: () => void;
}) {
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'categoryId') onFilter('categoryId', value);
      else if (key === 'sortBy') onFilter('sortBy', value);
    },
    [onFilter]
  );

  const handleToggleLowStock = React.useCallback(() => {
    onFilter('lowStock', !queryParams.lowStock);
  }, [onFilter, queryParams.lowStock]);

  const handleToggleHasStock = React.useCallback(() => {
    onFilter('hasStock', !queryParams.hasStock);
  }, [onFilter, queryParams.hasStock]);

  const handleClearFilters = React.useCallback(() => {
    if (onClearFilters) return onClearFilters();
    onFilter('categoryId', undefined);
    onFilter('lowStock', false);
    onFilter('hasStock', false);
    onFilter('startDate', undefined);
    onFilter('endDate', undefined);
  }, [onFilter, onClearFilters]);

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      onFilter('startDate', range.startDate);
      onFilter('endDate', range.endDate);
    },
    [onFilter]
  );

  const hasActiveFilters =
    !!queryParams.categoryId ||
    !!queryParams.lowStock ||
    !!queryParams.hasStock ||
    !!queryParams.startDate ||
    !!queryParams.endDate;

  return {
    handleFilterChange,
    handleToggleLowStock,
    handleToggleHasStock,
    handleClearFilters,
    handleDateRangeChange,
    hasActiveFilters,
  } as const;
}

// 提取视图：纯展示组件，便于压缩主函数行数
type InventoryToolbarViewProps = Pick<
  InventorySearchToolbarProps,
  'queryParams' | 'categoryOptions' | 'searchValue' | 'onSearch' | 'isSearching'
> & {
  handleFilterChange: (key: string, value: string | undefined) => void;
  handleToggleLowStock: () => void;
  handleToggleHasStock: () => void;
  handleDateRangeChange: (range: DateRangeValue) => void;
  handleClearFilters: () => void;
  hasActiveFilters: boolean;
};

function InventoryToolbarView({
  queryParams,
  categoryOptions,
  searchValue,
  onSearch,
  isSearching,
  handleFilterChange,
  handleToggleLowStock,
  handleToggleHasStock,
  handleDateRangeChange,
  handleClearFilters,
  hasActiveFilters,
}: InventoryToolbarViewProps) {
  return (
    <SearchFilterCard
      searchValue={searchValue ?? (queryParams.search || '')}
      onSearchChange={onSearch}
      searchPlaceholder={INVENTORY_FILTER_CONFIG.searchPlaceholder}
      isSearching={isSearching}
      // 筛选器配置
      filters={[
        {
          key: 'categoryId',
          label: '分类',
          options: categoryOptions.map(cat => ({
            label: cat.name,
            value: cat.id,
          })),
          width: 'w-[140px]',
        },
        {
          key: 'sortBy',
          label: '排序',
          options: INVENTORY_FILTER_CONFIG.filters[1].options,
          width: 'w-[140px]',
        },
      ]}
      filterValues={{
        categoryId: queryParams.categoryId || 'all',
        sortBy: queryParams.sortBy || 'updatedAt',
      }}
      onFilterChange={handleFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: INVENTORY_FILTER_CONFIG.dateRangeLabel,
        value: {
          startDate: queryParams.startDate,
          endDate: queryParams.endDate,
        },
        onChange: handleDateRangeChange,
        placeholder: INVENTORY_FILTER_CONFIG.dateRangePlaceholder,
      }}
      // Toggle 按钮
      toggleButtons={[
        {
          key: 'lowStock',
          label: '库存偏低',
          icon: <AlertTriangle className="mr-1 h-3 w-3" />,
          active: !!queryParams.lowStock,
          onClick: handleToggleLowStock,
        },
        {
          key: 'hasStock',
          label: '有库存',
          icon: <Package className="mr-1 h-3 w-3" />,
          active: !!queryParams.hasStock,
          onClick: handleToggleHasStock,
        },
      ]}
      // 清空筛选
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="elevated"
    />
  );
}
