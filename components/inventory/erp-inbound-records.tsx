'use client';

import * as React from 'react';

import { InboundRecordsTable } from '@/components/inventory/forms/inbound-records-table';
import { InboundRecordsSearchToolbar } from '@/components/inventory/inbound-records-search-toolbar';
import { useInboundRecordsState } from '@/hooks/use-inbound-records';
import type { InboundQueryParams } from '@/lib/types/inbound';

interface ERPInboundRecordsProps {
  initialParams?: InboundQueryParams;
}

/**
 * ERP风格入库记录组件
 * 符合中国ERP系统的紧凑布局和操作习惯
 *
 * ✅ 架构优化：
 * - PageHeader 已移至父组件（page-client.tsx），与厂家发货页面保持一致
 * - 只负责筛选和表格展示，职责更单一（SRP 原则）
 * - 使用 space-y-4 统一间距，与厂家发货页面保持一致
 * - 使用 UnifiedSearchBar 组件，与厂家发货页面样式完全一致
 */
export function ERPInboundRecords({ initialParams }: ERPInboundRecordsProps) {
  // 使用自定义Hook管理状态
  const {
    queryParams,
    inboundRecords,
    pagination,
    isLoading,
    error,
    handleFilter,
    handlePageChange,
    handleResetFilters,
  } = useInboundRecordsState(initialParams);

  // 本地状态管理 - 用于即时更新UI
  const [searchValue, setSearchValue] = React.useState(
    queryParams.search || ''
  );
  const [reasonFilter, setReasonFilter] = React.useState<string | 'all'>(
    queryParams.reason || 'all'
  );
  const [dateRange, setDateRange] = React.useState<{
    startDate?: string;
    endDate?: string;
  }>({
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
  });

  // 搜索处理
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearchValue(value);
      handleFilter('search', value);
    },
    [handleFilter]
  );

  // 入库原因筛选处理
  const handleReasonChange = React.useCallback(
    (value: string | 'all') => {
      setReasonFilter(value);
      handleFilter('reason', value === 'all' ? undefined : value);
    },
    [handleFilter]
  );

  // 日期范围处理
  const handleDateRangeChange = React.useCallback(
    (range: { startDate?: string; endDate?: string }) => {
      setDateRange(range);
      handleFilter('startDate', range.startDate);
      handleFilter('endDate', range.endDate);
    },
    [handleFilter]
  );

  // 清空筛选
  const handleClearFilters = React.useCallback(() => {
    setSearchValue('');
    setReasonFilter('all');
    setDateRange({});
    handleResetFilters();
  }, [handleResetFilters]);

  if (error) {
    return (
      <div
        className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-error-light))] p-6 text-center"
        style={{ boxShadow: 'var(--shadow-light)' }}
      >
        <div className="text-sm text-[hsl(var(--color-error))]">
          加载入库记录失败，请稍后重试
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 搜索工具栏 */}
      <InboundRecordsSearchToolbar
        searchValue={searchValue}
        reasonFilter={reasonFilter}
        dateRange={dateRange}
        isSearching={isLoading}
        onSearch={handleSearch}
        onReasonChange={handleReasonChange}
        onDateRangeChange={handleDateRangeChange}
        onClearFilters={handleClearFilters}
      />

      {/* 入库记录表格 */}
      <InboundRecordsTable
        records={inboundRecords}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
