'use client';

/**
 * 退货订单搜索工具栏
 * 使用统一的 SearchFilterCard 组件
 */

import { Clock, Package } from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import {
    RETURN_ORDER_STATUS_LABELS,
    RETURN_ORDER_TYPE_LABELS,
    RETURN_PROCESS_TYPE_LABELS,
    type ReturnOrderStatus,
    type ReturnOrderType,
    type ReturnProcessType,
} from '@/lib/types/return-order';

interface ReturnOrderSearchToolbarProps {
  searchValue: string;
  statusFilter: ReturnOrderStatus | 'all';
  typeFilter: ReturnOrderType | 'all';
  processTypeFilter: ReturnProcessType | 'all';
  dateRange: DateRangeValue;
  isSearching?: boolean;
  onSearch: (value: string) => void;
  onStatusChange: (value: ReturnOrderStatus | 'all') => void;
  onTypeChange: (value: ReturnOrderType | 'all') => void;
  onProcessTypeChange: (value: ReturnProcessType | 'all') => void;
  onDateRangeChange: (range: DateRangeValue) => void;
  onClearFilters: () => void;
}

export const ReturnOrderSearchToolbar =
  React.memo<ReturnOrderSearchToolbarProps>(
    ({
      searchValue,
      statusFilter,
      typeFilter,
      processTypeFilter,
      dateRange,
      isSearching,
      onSearch,
      onStatusChange,
      onTypeChange,
      onProcessTypeChange,
      onDateRangeChange,
      onClearFilters,
    }) => {
      const logic = useReturnOrderToolbarLogic({
        statusFilter,
        typeFilter,
        processTypeFilter,
        dateRange,
        onStatusChange,
        onTypeChange,
        onProcessTypeChange,
        onDateRangeChange,
        onClearFilters,
      });

      return (
        <ReturnOrderToolbarView
          searchValue={searchValue}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          processTypeFilter={processTypeFilter}
          isSearching={isSearching}
          dateRange={dateRange}
          onSearch={onSearch}
          {...logic}
        />
      );
    }
  );

ReturnOrderSearchToolbar.displayName = 'ReturnOrderSearchToolbar';

function useReturnOrderToolbarLogic({
  statusFilter,
  typeFilter,
  processTypeFilter,
  dateRange,
  onStatusChange,
  onTypeChange,
  onProcessTypeChange,
  onDateRangeChange,
  onClearFilters,
}: Pick<
  ReturnOrderSearchToolbarProps,
  | 'statusFilter'
  | 'typeFilter'
  | 'processTypeFilter'
  | 'dateRange'
  | 'onStatusChange'
  | 'onTypeChange'
  | 'onProcessTypeChange'
  | 'onDateRangeChange'
  | 'onClearFilters'
>) {
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'status') {
        onStatusChange(
          value && value !== 'all' ? (value as ReturnOrderStatus) : 'all'
        );
      } else if (key === 'type') {
        onTypeChange(
          value && value !== 'all' ? (value as ReturnOrderType) : 'all'
        );
      } else if (key === 'processType') {
        onProcessTypeChange(
          value && value !== 'all' ? (value as ReturnProcessType) : 'all'
        );
      }
    },
    [onStatusChange, onTypeChange, onProcessTypeChange]
  );

  const toggleStatus = React.useCallback(
    (status: ReturnOrderStatus) => () => {
      onStatusChange(statusFilter === status ? 'all' : status);
    },
    [onStatusChange, statusFilter]
  );

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      onDateRangeChange(range);
    },
    [onDateRangeChange]
  );

  const handleClearFilters = React.useCallback(() => {
    onClearFilters();
  }, [onClearFilters]);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    processTypeFilter !== 'all' ||
    !!dateRange.startDate ||
    !!dateRange.endDate;

  return {
    handleFilterChange,
    toggleStatus,
    handleDateRangeChange,
    handleClearFilters,
    hasActiveFilters,
  } as const;
}

type ReturnOrderToolbarViewProps = {
  searchValue: string;
  statusFilter: ReturnOrderStatus | 'all';
  typeFilter: ReturnOrderType | 'all';
  processTypeFilter: ReturnProcessType | 'all';
  dateRange: DateRangeValue;
  isSearching?: boolean;
  onSearch: (value: string) => void;
  handleFilterChange: (key: string, value: string | undefined) => void;
  toggleStatus: (status: ReturnOrderStatus) => () => void;
  handleDateRangeChange: (range: DateRangeValue) => void;
  handleClearFilters: () => void;
  hasActiveFilters: boolean;
};

function ReturnOrderToolbarView({
  searchValue,
  statusFilter,
  typeFilter,
  processTypeFilter,
  dateRange,
  isSearching,
  onSearch,
  handleFilterChange,
  toggleStatus,
  handleDateRangeChange,
  handleClearFilters,
  hasActiveFilters,
}: ReturnOrderToolbarViewProps) {
  return (
    <SearchFilterCard
      searchValue={searchValue}
      onSearchChange={onSearch}
      searchPlaceholder="搜索退货单号或客户名称..."
      isSearching={isSearching}
      // Toggle 按钮
      toggleButtons={[
        {
          key: 'submitted',
          label: '待审核',
          icon: <Clock className="h-3.5 w-3.5" />,
          active: statusFilter === 'submitted',
          onClick: toggleStatus('submitted'),
        },
        {
          key: 'processing',
          label: '处理中',
          icon: <Package className="h-3.5 w-3.5" />,
          active: statusFilter === 'processing',
          onClick: toggleStatus('processing'),
        },
      ]}
      // 筛选器配置
      filters={[
        {
          key: 'status',
          label: '状态',
          options: Object.entries(RETURN_ORDER_STATUS_LABELS).map(
            ([value, label]) => ({
              label,
              value,
            })
          ),
          width: 'w-full sm:w-40',
        },
        {
          key: 'type',
          label: '退货类型',
          options: Object.entries(RETURN_ORDER_TYPE_LABELS).map(
            ([value, label]) => ({
              label,
              value,
            })
          ),
          width: 'w-full sm:w-40',
        },
        {
          key: 'processType',
          label: '处理方式',
          options: Object.entries(RETURN_PROCESS_TYPE_LABELS).map(
            ([value, label]) => ({
              label,
              value,
            })
          ),
          width: 'w-full sm:w-40',
        },
      ]}
      filterValues={{
        status: statusFilter === 'all' ? 'all' : statusFilter,
        type: typeFilter === 'all' ? 'all' : typeFilter,
        processType:
          processTypeFilter === 'all' ? 'all' : processTypeFilter,
      }}
      onFilterChange={handleFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '退货日期',
        value: dateRange,
        onChange: handleDateRangeChange,
        placeholder: '选择退货日期范围',
      }}
      // 清空筛选
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="pro"
      compact={true}
    />
  );
}
