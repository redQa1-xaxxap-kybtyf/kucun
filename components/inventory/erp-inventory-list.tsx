'use client';

import * as React from 'react';

import { InventoryListActions } from '@/components/inventory/erp/inventory-list-actions';
import { InventoryPagination } from '@/components/inventory/erp/inventory-pagination';
import { InventoryTable } from '@/components/inventory/erp/inventory-table';
import { InventorySearchToolbar } from '@/components/inventory/InventorySearchToolbar';
import { useERPInventoryList } from '@/hooks/use-erp-inventory-list';
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
  isLoading?: boolean;
}

/**
 * ERP风格库存列表组件
 * 符合中国ERP系统的用户体验标准
 * 使用React.memo和子组件优化性能
 */
export const ERPInventoryList = React.memo<ERPInventoryListProps>(
  ({
    data,
    categoryOptions,
    queryParams,
    onSearch,
    onFilter,
    onPageChange,
    isLoading: _isLoading = false,
  }) => {
    const {
      selectedCount,
      hasData,
      canSelectAll,
      isAllSelected,
      selectedInventoryIds,
      handleRowSelect,
      handleSelectAll,
      handleAdjust,
      handleInbound,
      handleOutbound,
      handlePrevPage,
      handleNextPage,
    } = useERPInventoryList(data, onPageChange);

    return (
      <div className="space-y-4">
        {/* 搜索工具栏 */}
        <InventorySearchToolbar
          queryParams={queryParams}
          categoryOptions={categoryOptions}
          onSearch={onSearch}
          onFilter={onFilter}
          onInbound={handleInbound}
          onOutbound={handleOutbound}
          onAdjust={() => handleAdjust()}
        />

        {/* 操作栏 */}
        <InventoryListActions
          selectedCount={selectedCount}
          onInbound={handleInbound}
          onOutbound={handleOutbound}
          onAdjust={() => handleAdjust()}
        />

        {/* 库存表格 */}
        <div className="rounded border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">库存列表</h3>
              <div className="text-sm text-muted-foreground">
                {hasData ? `共 ${data.data.length} 条记录` : '暂无数据'}
              </div>
            </div>
          </div>

          <InventoryTable
            data={data.data}
            selectedIds={selectedInventoryIds}
            isAllSelected={isAllSelected}
            canSelectAll={canSelectAll}
            onSelectAll={handleSelectAll}
            onSelectRow={handleRowSelect}
            onAdjust={handleAdjust}
            useVirtualization={data.data.length > 50}
          />

          {/* 分页 */}
          <InventoryPagination
            pagination={data.pagination}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        </div>
      </div>
    );
  }
);

ERPInventoryList.displayName = 'ERPInventoryList';
