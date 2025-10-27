/**
 * 库存搜索工具栏组件
 * 包含搜索框、筛选器和操作按钮
 * ✅ 已迁移到使用 UnifiedSearchBar
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { AlertTriangle, Filter, Package } from 'lucide-react';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
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
  }) => {
    const logic = useInventoryToolbarLogic({ queryParams, onFilter, onClearFilters });

    return (
      <InventoryToolbarView
        queryParams={queryParams}
        categoryOptions={categoryOptions}
        searchValue={searchValue}
        onSearch={onSearch}
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
  'queryParams' | 'categoryOptions' | 'searchValue' | 'onSearch'
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
  handleFilterChange,
  handleToggleLowStock,
  handleToggleHasStock,
  handleDateRangeChange,
  handleClearFilters,
  hasActiveFilters,
}: InventoryToolbarViewProps) {
  return (
    <Card
      className="border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-light)' }}
    >
      <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <UnifiedSearchBar
            searchValue={searchValue ?? (queryParams.search || '')}
            onSearchChange={onSearch}
            searchPlaceholder="搜索产品名称、编码..."
            debounceDelay={0}
            compact={true}
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
            filters={[
              {
                key: 'categoryId',
                label: '分类',
                options: categoryOptions.map(cat => ({ label: cat.name, value: cat.id })),
                width: 'w-[140px]',
              },
              {
                key: 'sortBy',
                label: '排序',
                options: [
                  { label: '更新时间', value: 'updatedAt' },
                  { label: '库存数量', value: 'quantity' },
                ],
                width: 'w-[140px]',
              },
            ]}
            filterValues={{ categoryId: queryParams.categoryId, sortBy: queryParams.sortBy }}
            onFilterChange={handleFilterChange}
          />

          {Boolean((searchValue ?? queryParams.search ?? '').length === 1) && (
            <span className="text-muted-foreground text-xs">输入≥2个字符开始搜索</span>
          )}

          <DateRangePicker
            value={{ startDate: queryParams.startDate, endDate: queryParams.endDate }}
            onChange={handleDateRangeChange}
            label=""
            placeholder="选择更新时间范围"
            showPresets
            showClearButton
            className="w-full min-w-[220px] sm:w-auto"
          />

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 gap-1.5 transition-all hover:border-blue-300 hover:bg-blue-50"
            >
              <Filter className="h-3.5 w-3.5" />
              清空筛选
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
