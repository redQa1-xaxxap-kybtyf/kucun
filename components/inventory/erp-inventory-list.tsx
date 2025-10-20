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
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
  onPageChange: (page: number) => void;
  /** ✅ hover 预取下一页 */
  onNextPageHover?: () => void;
  /** ✅ hover 预取上一页 */
  onPrevPageHover?: () => void;
  isLoading?: boolean;
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
    onSearch,
    onFilter,
    onPageChange,
    onNextPageHover,
    onPrevPageHover,
    isLoading: _isLoading = false,
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
          onSearch={onSearch}
          onFilter={onFilter}
        />

        {/* 库存列表 */}
        <div
          className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
          style={{ boxShadow: 'var(--shadow-medium)' }}
        >
          <InventoryTable
            data={data.data}
            onAdjust={handleAdjust}
            useVirtualization={data.data.length > 50}
          />

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
