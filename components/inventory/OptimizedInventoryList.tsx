/**
 * 优化的库存列表组件
 * 集成所有性能优化技术：防抖搜索、虚拟滚动、React Query优化、组件性能优化
 */

'use client';

import * as React from 'react';

import { InventoryListActions } from '@/components/inventory/erp/inventory-list-actions';
import { InventorySearchToolbar } from '@/components/inventory/InventorySearchToolbar';
import { VirtualizedInventoryTable } from '@/components/inventory/VirtualizedInventoryTable';
import { useOptimizedInventoryList } from '@/hooks/use-optimized-inventory-list';
import type { InventoryQueryParams } from '@/lib/types/inventory';

interface OptimizedInventoryListProps {
  initialParams?: Partial<InventoryQueryParams>;
  categoryOptions: Array<{ id: string; name: string }>;
  /** 是否启用虚拟滚动 */
  enableVirtualization?: boolean;
  /** 虚拟滚动配置 */
  virtualizationConfig?: {
    itemHeight?: number;
    containerHeight?: number;
    overscan?: number;
  };
}

/**
 * 优化的库存列表组件
 * 使用React.memo和所有性能优化技术
 */
export const OptimizedInventoryList = React.memo<OptimizedInventoryListProps>(
  ({
    initialParams = {},
    categoryOptions,
    enableVirtualization: _enableVirtualization = true,
    virtualizationConfig = {
      itemHeight: 60,
      containerHeight: 400,
      overscan: 5,
    },
  }) => {
    const {
      queryParams,
      selectedIds,
      inventoryData,
      pagination: _pagination,
      isLoading: _isLoading,
      isError,
      error,
      cache,
      handleSearch,
      handleFilter,
      handlePageChange: _handlePageChange,
      handleInbound,
      handleOutbound,
      handleAdjust,
      handleSelectAll,
      handleSelectRow,
    } = useOptimizedInventoryList(initialParams);

    // 错误状态处理
    if (isError) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-destructive">加载库存数据失败</p>
            <p className="text-sm text-muted-foreground">
              {error?.message || '请稍后重试'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* 搜索工具栏 */}
        <InventorySearchToolbar
          queryParams={queryParams}
          categoryOptions={categoryOptions}
          onSearch={handleSearch}
          onFilter={handleFilter}
          onInbound={handleInbound}
          onOutbound={handleOutbound}
          onAdjust={() => handleAdjust()}
        />

        {/* 操作栏 */}
        <div className="flex items-center justify-between">
          <InventoryListActions
            selectedCount={selectedIds.length}
            onInbound={handleInbound}
            onOutbound={handleOutbound}
            onAdjust={() => handleAdjust()}
          />

          {/* 缓存状态指示器（开发环境） */}
          {process.env.NODE_ENV === 'development' && cache && (
            <div className="text-xs text-muted-foreground">缓存可用</div>
          )}
        </div>

        {/* 虚拟化表格 */}
        <VirtualizedInventoryTable
          data={inventoryData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onAdjust={handleAdjust}
          itemHeight={virtualizationConfig.itemHeight}
          containerHeight={virtualizationConfig.containerHeight}
          overscan={virtualizationConfig.overscan}
        />
      </div>
    );
  }
);

OptimizedInventoryList.displayName = 'OptimizedInventoryList';
