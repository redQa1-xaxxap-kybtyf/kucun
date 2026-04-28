'use client';

import * as React from 'react';

import { OutboundRecordsTable } from '@/components/inventory/forms/outbound-records-table';
import { OutboundRecordsSearchToolbar } from '@/components/inventory/outbound-records-search-toolbar';
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
    isLoading,
    resetFilters,
    updateFilter,
    onPageChange,
  } = useOutboundRecords(initialParams);

  // 本地同步搜索值（可选，为了更好的搜索体验）
  const [searchValue, setSearchValue] = React.useState(filters.search || '');
  React.useEffect(() => {
    setSearchValue(filters.search || '');
  }, [filters.search]);

  return (
    <div className="space-y-4">
      {/* 搜索工具栏 */}
      <OutboundRecordsSearchToolbar
        searchValue={searchValue}
        typeFilter={filters.type || 'all'}
        dateRange={{
          startDate: filters.startDate,
          endDate: filters.endDate,
        }}
        isSearching={isLoading}
        onSearch={val => {
          setSearchValue(val);
          updateFilter('search', val);
        }}
        onTypeChange={val => updateFilter('type', val)}
        onDateRangeChange={range => {
          updateFilter('startDate', range.startDate || '');
          updateFilter('endDate', range.endDate || '');
        }}
        onClearFilters={resetFilters}
      />

      {/* 出库记录表格 */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <OutboundRecordsTable
          records={outboundRecords}
          pagination={pagination}
          isLoading={isLoading}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
