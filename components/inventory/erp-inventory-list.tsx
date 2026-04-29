'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { InventoryTable } from '@/components/inventory/erp/inventory-table';
import { InventorySearchToolbar } from '@/components/inventory/InventorySearchToolbar';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
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
    isLoading = false,
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
    const isInitialLoading = isLoading && data.data.length === 0;
    const isListRefreshing =
      !isInitialLoading && (isFetching || isSearching);
    const resultHeadline = isInitialLoading
      ? '正在加载库存数据'
      : hasActiveFilters
        ? `当前匹配 ${totalGroups} 个产品`
        : `当前共 ${totalGroups} 个产品`;
    const resultDescription = isInitialLoading
      ? `按产品归并展示，不同批次分开展示，${INVENTORY_SEARCH_HINT}`
      : totalPages > 1
        ? `第 ${currentPage} / ${totalPages} 页，按产品归并展示，不同批次分开展示，${INVENTORY_SEARCH_HINT}`
        : `按产品归并展示，不同批次分开展示，${INVENTORY_SEARCH_HINT}`;

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
          isSearching={isSearching || isListRefreshing}
          isExporting={isExporting}
          density={density}
          onDensityChange={onDensityChange}
          onExport={onExport}
        />

        <div
          data-testid="inventory-query-summary"
          className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3"
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
        <div
          className="relative overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm"
          aria-busy={isInitialLoading || isListRefreshing}
        >
          {isListRefreshing && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center border-b border-[hsl(var(--color-border-primary))] bg-white/95 px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))] shadow-sm">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-[hsl(var(--color-primary))]" />
              正在更新
            </div>
          )}

          <div
            className={
              isListRefreshing
                ? 'overflow-x-auto opacity-60 transition-opacity'
                : 'overflow-x-auto transition-opacity'
            }
          >
            {isInitialLoading ? (
              <InventoryListTableSkeleton />
            ) : (
              <InventoryTable
                data={data.data}
                onAdjust={handleAdjust}
                useVirtualization={data.data.length > 50}
                searchQuery={queryParams.search}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={onClearFilters}
                density={density}
              />
            )}
          </div>

          {/* 分页器 */}
          {data.pagination && !isInitialLoading && (
            <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
              <Pagination
                pagination={data.pagination}
                onPageChange={onPageChange}
                onNextPageHover={onNextPageHover}
                onPrevPageHover={onPrevPageHover}
                showRange={false}
                showTotal={false}
                disabled={isListRefreshing}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

ERPInventoryList.displayName = 'ERPInventoryList';

function InventoryListTableSkeleton() {
  return (
    <>
      <div className="space-y-3 p-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`inventory-mobile-skeleton-${index}`}
            className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-14 w-14 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-40" />
                <div className="flex flex-wrap gap-1.5">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((__, metricIndex) => (
                <div
                  key={`inventory-mobile-metric-skeleton-${index}-${metricIndex}`}
                  className="rounded-lg bg-[hsl(var(--color-bg-secondary))] px-2.5 py-2"
                >
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="mt-2 h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <div className="border-b bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <div className="grid min-w-[980px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_90px] gap-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton
                key={`inventory-header-skeleton-${index}`}
                className="h-4 w-full"
              />
            ))}
          </div>
        </div>

        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <div
            key={`inventory-row-skeleton-${rowIndex}`}
            className="border-b px-4 py-3 last:border-b-0"
          >
            <div className="grid min-w-[980px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_90px] items-center gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-8 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
