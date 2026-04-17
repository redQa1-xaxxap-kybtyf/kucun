'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { InventoryTable } from '@/components/inventory/erp/inventory-table';
import { InventorySearchToolbar } from '@/components/inventory/InventorySearchToolbar';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  buildInventorySortMode,
  DEFAULT_INVENTORY_SORT_MODE,
  getInventorySortModeLabel,
  INVENTORY_SEARCH_HINT,
} from '@/lib/configs/filter-configs';
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';

interface ERPInventoryListProps {
  data: {
    data: Inventory[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  categoryOptions: Array<{
    id: string;
    name: string;
    fullPath?: string;
    level?: number;
  }>;
  queryParams: InventoryQueryParams;
  /** ✅ 本地输入框值，提供即时UI反馈 */
  searchValue?: string;
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
  onFilterPatch?: (updates: Partial<InventoryQueryParams>) => void;
  /** ✅ 新增：批量清空筛选回调 */
  onClearFilters?: () => void;
  onPageChange: (page: number) => void;
  /** ✅ hover 预取下一页 */
  onNextPageHover?: () => void;
  /** ✅ hover 预取上一页 */
  onPrevPageHover?: () => void;
  isLoading?: boolean;
  isFetching?: boolean;
  /** ✅ 新增：搜索状态指示 */
  /** ✅ 新增：搜索状态指示 */
  isSearching?: boolean;
  isExporting?: boolean;
  density: 'compact' | 'comfortable';
  onDensityChange: (density: 'compact' | 'comfortable') => void;
  onExport: () => void;
}

function formatDateRangeSummary(
  startDate?: string,
  endDate?: string
): string | null {
  if (startDate && endDate) {
    return `${startDate} 至 ${endDate}`;
  }

  if (startDate) {
    return `${startDate} 起`;
  }

  if (endDate) {
    return `截止 ${endDate}`;
  }

  return null;
}

/**
 * ERP风格库存列表组件
 * 符合中国ERP系统的用户体验标准
 * 使用React.memo和子组件优化性能
 * ✅ 符合产品模块UI风格规范
 */
export const ERPInventoryList = React.memo<ERPInventoryListProps>(
  ({
    data,
    categoryOptions,
    queryParams,
    searchValue,
    onSearch,
    onFilter,
    onFilterPatch,
    onClearFilters,
    onPageChange,
    onNextPageHover,
    onPrevPageHover,
    isLoading: _isLoading = false,
    isFetching = false,
    isSearching = false,
    isExporting = false,
    density,
    onDensityChange,
    onExport,
  }) => {
    const router = useRouter();

    const handleAdjust = React.useCallback(
      (inventoryId: string) => {
        const inventory = data.data.find(item => item.id === inventoryId);
        if (!inventory || !inventory.batchNumber) {
          return;
        }

        const params = new URLSearchParams();
        params.set('inventoryId', inventoryId);
        if (inventory.productId) {
          params.set('productId', inventory.productId);
        }
        if (inventory.variantId) {
          params.set('variantId', inventory.variantId);
        } else {
          params.set('variantId', 'null');
        }

        router.push(
          `/inventory/batch/${encodeURIComponent(inventory.batchNumber)}/history?${params.toString()}`
        );
      },
      [data.data, router]
    );

    const hasActiveFilters = React.useMemo(
      () =>
        !!(
          queryParams.search?.trim() ||
          queryParams.categoryId ||
          queryParams.lowStock ||
          queryParams.hasStock ||
          queryParams.startDate ||
          queryParams.endDate ||
          buildInventorySortMode(
            queryParams.sortBy || 'updatedAt',
            queryParams.sortOrder || 'desc'
          ) !== DEFAULT_INVENTORY_SORT_MODE
        ),
      [
        queryParams.categoryId,
        queryParams.endDate,
        queryParams.hasStock,
        queryParams.lowStock,
        queryParams.search,
        queryParams.sortBy,
        queryParams.sortOrder,
        queryParams.startDate,
      ]
    );

    const querySummaryItems = React.useMemo(() => {
      const items: Array<{ key: string; label: string; value: string }> = [];
      const categoryName = categoryOptions.find(
        category => category.id === queryParams.categoryId
      );
      const keyword = queryParams.search?.trim();
      const dateRangeSummary = formatDateRangeSummary(
        queryParams.startDate,
        queryParams.endDate
      );

      if (keyword) {
        items.push({
          key: 'keyword',
          label: '关键词',
          value: keyword,
        });
      }

      if (categoryName) {
        items.push({
          key: 'category',
          label: '分类',
          value: categoryName.fullPath ?? categoryName.name,
        });
      }

      if (queryParams.lowStock) {
        items.push({
          key: 'lowStock',
          label: '筛选',
          value: '库存偏低',
        });
      }

      if (queryParams.hasStock) {
        items.push({
          key: 'hasStock',
          label: '筛选',
          value: '仅看有库存',
        });
      }

      if (dateRangeSummary) {
        items.push({
          key: 'dateRange',
          label: '更新时间',
          value: dateRangeSummary,
        });
      }

      items.push({
        key: 'sort',
        label: '排序',
        value: getInventorySortModeLabel(
          queryParams.sortBy || 'updatedAt',
          queryParams.sortOrder || 'desc'
        ),
      });

      return items;
    }, [
      categoryOptions,
      queryParams.categoryId,
      queryParams.endDate,
      queryParams.hasStock,
      queryParams.lowStock,
      queryParams.search,
      queryParams.sortBy,
      queryParams.sortOrder,
      queryParams.startDate,
    ]);

    const totalGroups = data.pagination?.total ?? data.data.length;
    const totalPages = data.pagination?.totalPages ?? 1;
    const currentPage = data.pagination?.page ?? 1;
    const resultHeadline = hasActiveFilters
      ? `当前匹配 ${totalGroups} 个产品编码`
      : `当前共 ${totalGroups} 个产品编码`;
    const resultDescription =
      totalPages > 1
        ? `第 ${currentPage} / ${totalPages} 页，按产品编码分组展示，${INVENTORY_SEARCH_HINT}`
        : `按产品编码分组展示，${INVENTORY_SEARCH_HINT}`;

    return (
      <div className="space-y-4">
        {/* 搜索和筛选区域 */}
        <InventorySearchToolbar
          queryParams={queryParams}
          categoryOptions={categoryOptions}
          searchValue={searchValue}
          onSearch={onSearch}
          onFilter={onFilter}
          onFilterPatch={onFilterPatch}
          onClearFilters={onClearFilters}
          isSearching={isSearching || isFetching}
          isExporting={isExporting}
          density={density}
          onDensityChange={onDensityChange}
          onExport={onExport}
        />

        <div
          data-testid="inventory-query-summary"
          className="rounded-2xl border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                {resultHeadline}
              </p>
              <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                {resultDescription}
              </p>
            </div>

            {hasActiveFilters && onClearFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 justify-start rounded-full px-3 text-[hsl(var(--color-text-secondary))] sm:justify-center"
                onClick={onClearFilters}
              >
                清空条件
              </Button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {querySummaryItems.map(item => (
              <span
                key={item.key}
                className="inline-flex max-w-full items-center rounded-full bg-white px-3 py-1 text-xs text-[hsl(var(--color-text-secondary))] shadow-sm"
              >
                <span className="mr-1 shrink-0 font-medium text-[hsl(var(--color-text-primary))]">
                  {item.label}:
                </span>
                <span className="truncate">{item.value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 库存列表 */}
        <div className="card-shadow-medium relative rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
          {/* ✅ 加载中提示 */}
          {isFetching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
              <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-lg">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--color-primary))] border-t-transparent" />
                <span className="text-sm text-gray-600">加载中...</span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <InventoryTable
              data={data.data}
              onAdjust={handleAdjust}
              useVirtualization={data.data.length > 50}
              searchQuery={queryParams.search}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={onClearFilters}
              density={density}
            />
          </div>

          {/* 分页器 */}
          {data.pagination && (
            <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
              <Pagination
                pagination={data.pagination}
                onPageChange={onPageChange}
                onNextPageHover={onNextPageHover}
                onPrevPageHover={onPrevPageHover}
                showRange={false}
                showTotal={false}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

ERPInventoryList.displayName = 'ERPInventoryList';
