'use client';

import * as React from 'react';

import { InventoryTable } from '@/components/inventory/erp/inventory-table';
import { InventoryListToolbar } from '@/components/inventory/inventory-list-toolbar';
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
        {/* 固定区域：工具栏和筛选 - 固定在顶部 */}
        <div className="sticky top-0 z-20 space-y-4 bg-gray-50 px-6 pt-6 pb-4">
          {/* 工具栏 */}
          <InventoryListToolbar
            selectedCount={selectedInventoryIds.length}
            onBatchInbound={handleInbound}
            onBatchOutbound={handleOutbound}
          />

          {/* 搜索和筛选区域 */}
          <InventorySearchToolbar
            queryParams={queryParams}
            categoryOptions={categoryOptions}
            onSearch={onSearch}
            onFilter={onFilter}
          />
        </div>

        {/* 表格 - 页面滚动，表头使用 sticky 固定 */}
        <div className="mx-6 rounded-lg border bg-white shadow-lg shadow-gray-200/50">
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
        </div>

        {/* 分页器 */}
        {data.pagination && (
          <div className="mx-6 mb-6 rounded-lg border bg-gray-50/50 px-4 py-3 shadow-md">
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
    );
  }
);

ERPInventoryList.displayName = 'ERPInventoryList';
