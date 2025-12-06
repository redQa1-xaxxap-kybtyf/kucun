'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { InventoryTable } from '@/components/inventory/erp/inventory-table';
import { InventorySearchToolbar } from '@/components/inventory/InventorySearchToolbar';
import { Pagination } from '@/components/ui/pagination';
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
  categoryOptions: Array<{ id: string; name: string }>;
  queryParams: InventoryQueryParams;
  /** ✅ 本地输入框值，提供即时UI反馈 */
  searchValue?: string;
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
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
  density: 'compact' | 'comfortable';
  onDensityChange: (density: 'compact' | 'comfortable') => void;
  onExport: () => void;
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
    onClearFilters,
    onPageChange,
    onNextPageHover,
    onPrevPageHover,
    isLoading: _isLoading = false,
    isFetching = false,
    isSearching = false,
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

    return (
      <div className="space-y-4">
        {/* 搜索和筛选区域 */}
        <InventorySearchToolbar
          queryParams={queryParams}
          categoryOptions={categoryOptions}
          searchValue={searchValue}
          onSearch={onSearch}
          onFilter={onFilter}
          onClearFilters={onClearFilters}
          isSearching={isSearching || isFetching}
          density={density}
          onDensityChange={onDensityChange}
          onExport={onExport}
        />

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
                showRange
                showTotal
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

ERPInventoryList.displayName = 'ERPInventoryList';
