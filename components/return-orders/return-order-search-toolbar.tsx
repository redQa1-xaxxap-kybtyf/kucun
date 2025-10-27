'use client';

/**
 * 退货订单搜索工具栏
 * 对齐库存模块的优秀方案：统一的搜索栏、快捷筛选、日期范围与清空功能
 */

import { Clock, Filter, Package } from 'lucide-react';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
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
    <Card
      className="border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-light)' }}
    >
      <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <UnifiedSearchBar
            searchValue={searchValue}
            onSearchChange={onSearch}
            searchPlaceholder="搜索退货单号或客户名称..."
            debounceDelay={0}
            compact
            isSearching={isSearching}
            toggleButtons={[
              {
                key: 'pending_review',
                label: '待审核',
                icon: <Clock className="h-3.5 w-3.5" />,
                active: statusFilter === 'pending_review',
                onClick: toggleStatus('pending_review'),
              },
              {
                key: 'processing',
                label: '处理中',
                icon: <Package className="h-3.5 w-3.5" />,
                active: statusFilter === 'processing',
                onClick: toggleStatus('processing'),
              },
            ]}
            filters={[
              {
                key: 'status',
                label: '状态',
                includeAllOption: true,
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
                includeAllOption: true,
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
                includeAllOption: true,
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
          />

          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            label=""
            placeholder="选择退货日期范围"
            showPresets
            showClearButton
            className="w-full min-w-[220px] sm:w-auto"
          />

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 gap-1.5 transition-all hover:border-blue-300 hover:bg-blue-50"
            >
              <Filter className="h-3.5 w-3.5" />
              清空筛选
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
