'use client';

import * as React from 'react';

import { InventoryListToolbar } from '@/components/inventory/inventory-list-toolbar';
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
      <div className="space-y-6">
        {/* 工具栏 */}
        <InventoryListToolbar
          selectedCount={selectedInventoryIds.length}
          onBatchInbound={handleInbound}
          onBatchOutbound={handleOutbound}
        />

        {/* 搜索和筛选 */}
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
        <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
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

          {/* 分页组件 */}
          {data.pagination && (
            <div className="border-t bg-gray-50/50 px-4 py-3">
              <Pagination
                pagination={data.pagination}
                onPageChange={onPageChange}
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
