'use client';

/**
 * 退货订单搜索工具栏
 * 使用统一的 SearchFilterCard 组件
 */

import { Ban, Clock3, Eye, Wallet } from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import {
  RETURN_ORDER_UI_STATUS_LABELS,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
  type ReturnOrderType,
  type ReturnProcessType,
  type ReturnOrderUiStatus,
} from '@/lib/types/return-order';

interface ReturnOrderSearchToolbarProps {
  searchValue: string;
  statusFilter: ReturnOrderUiStatus | 'all';
  typeFilter: ReturnOrderType | 'all';
  processTypeFilter: ReturnProcessType | 'all';
  includeTest?: boolean;
  includeVoided?: boolean;
  dateRange: DateRangeValue;
  isSearching?: boolean;
  onSearch: (value: string) => void;
  onStatusChange: (value: ReturnOrderUiStatus | 'all') => void;
  onTypeChange: (value: ReturnOrderType | 'all') => void;
  onProcessTypeChange: (value: ReturnProcessType | 'all') => void;
  onIncludeTestToggle: () => void;
  onIncludeVoidedToggle: () => void;
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
      includeTest,
      includeVoided,
      dateRange,
      isSearching,
      onSearch,
      onStatusChange,
      onTypeChange,
      onProcessTypeChange,
      onIncludeTestToggle,
      onIncludeVoidedToggle,
      onDateRangeChange,
      onClearFilters,
    }) => {
      const logic = useReturnOrderToolbarLogic({
        searchValue,
        statusFilter,
        typeFilter,
        processTypeFilter,
        includeTest,
        includeVoided,
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
          includeTest={includeTest}
          includeVoided={includeVoided}
          isSearching={isSearching}
          dateRange={dateRange}
          onSearch={onSearch}
          onIncludeTestToggle={onIncludeTestToggle}
          onIncludeVoidedToggle={onIncludeVoidedToggle}
          {...logic}
        />
      );
    }
  );

ReturnOrderSearchToolbar.displayName = 'ReturnOrderSearchToolbar';

function useReturnOrderToolbarLogic({
  searchValue,
  statusFilter,
  typeFilter,
  processTypeFilter,
  includeTest,
  includeVoided,
  dateRange,
  onStatusChange,
  onTypeChange,
  onProcessTypeChange,
  onDateRangeChange,
  onClearFilters,
}: Pick<
  ReturnOrderSearchToolbarProps,
  | 'searchValue'
  | 'statusFilter'
  | 'typeFilter'
  | 'processTypeFilter'
  | 'includeTest'
  | 'includeVoided'
  | 'dateRange'
  | 'onStatusChange'
  | 'onTypeChange'
  | 'onProcessTypeChange'
  | 'onDateRangeChange'
  | 'onClearFilters'
>) {
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'uiStatus') {
        onStatusChange(
          value && value !== 'all' ? (value as ReturnOrderUiStatus) : 'all'
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
    (status: ReturnOrderUiStatus) => () => {
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
    !!searchValue.trim() ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    processTypeFilter !== 'all' ||
    !!includeTest ||
    !!includeVoided ||
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
  statusFilter: ReturnOrderUiStatus | 'all';
  typeFilter: ReturnOrderType | 'all';
  processTypeFilter: ReturnProcessType | 'all';
  includeTest?: boolean;
  includeVoided?: boolean;
  dateRange: DateRangeValue;
  isSearching?: boolean;
  onSearch: (value: string) => void;
  onIncludeTestToggle: () => void;
  onIncludeVoidedToggle: () => void;
  handleFilterChange: (key: string, value: string | undefined) => void;
  toggleStatus: (status: ReturnOrderUiStatus) => () => void;
  handleDateRangeChange: (range: DateRangeValue) => void;
  handleClearFilters: () => void;
  hasActiveFilters: boolean;
};

function ReturnOrderToolbarView({
  searchValue,
  statusFilter,
  typeFilter,
  processTypeFilter,
  includeTest,
  includeVoided,
  dateRange,
  isSearching,
  onSearch,
  onIncludeTestToggle,
  onIncludeVoidedToggle,
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
          key: 'pending',
          label: '待处理',
          icon: <Clock3 className="h-3.5 w-3.5" />,
          active: statusFilter === 'pending',
          onClick: toggleStatus('pending'),
        },
        {
          key: 'awaiting_refund',
          label: '待退款',
          icon: <Wallet className="h-3.5 w-3.5" />,
          active: statusFilter === 'awaiting_refund',
          onClick: toggleStatus('awaiting_refund'),
        },
        {
          key: 'includeTest',
          label: '显示测试',
          icon: <Eye className="h-3.5 w-3.5" />,
          active: !!includeTest,
          onClick: onIncludeTestToggle,
        },
        {
          key: 'includeVoided',
          label: '显示作废',
          icon: <Ban className="h-3.5 w-3.5" />,
          active: !!includeVoided,
          onClick: onIncludeVoidedToggle,
        },
      ]}
      // 筛选器配置
      filters={[
        {
          key: 'uiStatus',
          label: '状态',
          options: Object.entries(RETURN_ORDER_UI_STATUS_LABELS).map(
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
        uiStatus: statusFilter === 'all' ? 'all' : statusFilter,
        type: typeFilter === 'all' ? 'all' : typeFilter,
        processType: processTypeFilter === 'all' ? 'all' : processTypeFilter,
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
