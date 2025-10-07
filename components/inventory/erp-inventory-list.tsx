'use client';

import * as React from 'react';

import { ScrollableTableContainer } from '@/components/common/ScrollableTableContainer';
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
      <ScrollableTableContainer
        header={
          <div className="space-y-4">
            {/* 固定的工具栏 */}
            <InventoryListToolbar
              selectedCount={selectedInventoryIds.length}
              onBatchInbound={handleInbound}
              onBatchOutbound={handleOutbound}
            />

            {/* 固定的搜索和筛选区域 */}
            <InventorySearchToolbar
              queryParams={queryParams}
              categoryOptions={categoryOptions}
              onSearch={onSearch}
              onFilter={onFilter}
            />
          </div>
        }
        footer={
          /* 固定的分页器 */
          data.pagination && (
            <div className="bg-gray-50/50 px-4 py-3">
              <Pagination
                pagination={data.pagination}
                onPageChange={onPageChange}
                onNextPageHover={onNextPageHover}
                onPrevPageHover={onPrevPageHover}
                showRange
                showTotal
              />
            </div>
          )
        }
      >
        {/* 可滚动的表格内容 */}
        <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50 [&>div]:!overflow-visible">
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
      </ScrollableTableContainer>
    );
  }
);

ERPInventoryList.displayName = 'ERPInventoryList';
