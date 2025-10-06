'use client';

import * as React from 'react';

import { InventoryTable } from '@/components/inventory/erp/inventory-table';
import { InventorySearchToolbar } from '@/components/inventory/InventorySearchToolbar';
import { Pagination } from '@/components/ui/pagination';
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

        {/* 库存表格 */}
        <div className="bg-card rounded border">
          <div className="bg-muted/30 border-b px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">库存列表</h3>
              <div className="text-muted-foreground text-sm">
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
          {data.pagination && (
            <Pagination
              pagination={data.pagination}
              onPageChange={onPageChange}
              showRange
              showTotal
            />
          )}
        </div>
      </div>
    );
  }
);

ERPInventoryList.displayName = 'ERPInventoryList';
