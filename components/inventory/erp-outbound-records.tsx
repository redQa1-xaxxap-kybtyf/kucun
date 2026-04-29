'use client';

import * as React from 'react';

import { OutboundRecordsTable } from '@/components/inventory/forms/outbound-records-table';
import { OutboundRecordsSearchToolbar } from '@/components/inventory/outbound-records-search-toolbar';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import { useOutboundRecords } from '@/hooks/use-outbound-records';
import type { OutboundRecordQueryParams } from '@/lib/types/inventory';

interface ERPOutboundRecordsProps {
  initialParams?: OutboundRecordQueryParams;
}

/**
 * ERP风格的出库记录组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 * 出库记录列表
 */
export function ERPOutboundRecords({ initialParams }: ERPOutboundRecordsProps) {
  const {
    outboundRecords,
    pagination,
    filters,
    isInitialLoading,
    isListRefreshing,
    resetFilters,
    updateFilter,
    onPageChange,
  } = useOutboundRecords(initialParams);

  const {
    searchInput,
    isSearching,
    handleSearchChange,
    cancelPendingCommit,
    setSearchInput,
  } = useListSearchController({
    committedValue: filters.search,
    onCommit: value => {
      updateFilter('search', value ?? '');
    },
  });

  const handleClearFilters = React.useCallback(() => {
    cancelPendingCommit();
    setSearchInput('');
    resetFilters();
  }, [cancelPendingCommit, resetFilters, setSearchInput]);

  return (
    <div className="space-y-4">
      {/* 搜索工具栏 */}
      <OutboundRecordsSearchToolbar
        searchValue={searchInput}
        typeFilter={filters.type || 'all'}
        dateRange={{
          startDate: filters.startDate,
          endDate: filters.endDate,
        }}
        isSearching={isSearching || isListRefreshing}
        onSearch={handleSearchChange}
        onTypeChange={val => updateFilter('type', val)}
        onDateRangeChange={range => {
          updateFilter('startDate', range.startDate || '');
          updateFilter('endDate', range.endDate || '');
        }}
        onClearFilters={handleClearFilters}
      />

      {/* 出库记录表格 */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <OutboundRecordsTable
          records={outboundRecords}
          pagination={pagination}
          isLoading={isInitialLoading}
          isRefreshing={isSearching || isListRefreshing}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
