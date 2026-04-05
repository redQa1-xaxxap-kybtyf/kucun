'use client';

/**
 * 厂家发货搜索工具栏
 * 使用统一的 SearchFilterCard 组件
 */

import { Clock, Truck } from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import {
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

interface FactoryShipmentSearchToolbarProps {
  /** 搜索关键词（受控） */
  searchValue: string;
  /** 状态筛选（'all' 表示全部） */
  statusFilter: FactoryShipmentStatus | 'all';
  /** 日期范围筛选 */
  dateRange: DateRangeValue;
  /** 输入框加载指示 */
  isSearching?: boolean;
  /** 搜索回调 */
  onSearch: (value: string) => void;
  /** 状态筛选回调 */
  onStatusChange: (value: FactoryShipmentStatus | 'all') => void;
  /** 日期范围变更 */
  onDateRangeChange: (range: DateRangeValue) => void;
  /** 清空筛选回调 */
  onClearFilters: () => void;
}

export const FactoryShipmentSearchToolbar =
  React.memo<FactoryShipmentSearchToolbarProps>(
    ({
      searchValue,
      statusFilter,
      dateRange,
      isSearching,
      onSearch,
      onStatusChange,
      onDateRangeChange,
      onClearFilters,
    }) => {
      const logic = useFactoryShipmentToolbarLogic({
        searchValue,
        statusFilter,
        dateRange,
        onStatusChange,
        onDateRangeChange,
        onClearFilters,
      });

      return (
        <FactoryShipmentToolbarView
          searchValue={searchValue}
          statusFilter={statusFilter}
          isSearching={isSearching}
          dateRange={dateRange}
          onSearch={onSearch}
          {...logic}
        />
      );
    }
  );

FactoryShipmentSearchToolbar.displayName = 'FactoryShipmentSearchToolbar';

function useFactoryShipmentToolbarLogic({
  searchValue,
  statusFilter,
  dateRange,
  onStatusChange,
  onDateRangeChange,
  onClearFilters,
}: Pick<
  FactoryShipmentSearchToolbarProps,
  | 'searchValue'
  | 'statusFilter'
  | 'dateRange'
  | 'onStatusChange'
  | 'onDateRangeChange'
  | 'onClearFilters'
>) {
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'status') {
        onStatusChange(
          value && value !== 'all' ? (value as FactoryShipmentStatus) : 'all'
        );
      }
    },
    [onStatusChange]
  );

  const toggleStatus = React.useCallback(
    (status: FactoryShipmentStatus) => () => {
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

type FactoryShipmentToolbarViewProps = {
  searchValue: string;
  statusFilter: FactoryShipmentStatus | 'all';
  dateRange: DateRangeValue;
  isSearching?: boolean;
  onSearch: (value: string) => void;
  handleFilterChange: (key: string, value: string | undefined) => void;
  toggleStatus: (status: FactoryShipmentStatus) => () => void;
  handleDateRangeChange: (range: DateRangeValue) => void;
  handleClearFilters: () => void;
  hasActiveFilters: boolean;
};

function FactoryShipmentToolbarView({
  searchValue,
  statusFilter,
  dateRange,
  isSearching,
  onSearch,
  handleFilterChange,
  toggleStatus,
  handleDateRangeChange,
  handleClearFilters,
  hasActiveFilters,
}: FactoryShipmentToolbarViewProps) {
  return (
    <SearchFilterCard
      searchValue={searchValue}
      onSearchChange={onSearch}
      searchPlaceholder="搜索集装箱号码或订单编号..."
      isSearching={isSearching}
      // Toggle 按钮
      toggleButtons={[
        {
          key: 'pending_shipment',
          label: '待发货',
          icon: <Clock className="h-3.5 w-3.5" />,
          active: statusFilter === 'pending_shipment',
          onClick: toggleStatus('pending_shipment'),
        },
        {
          key: 'in_transit',
          label: '运输中',
          icon: <Truck className="h-3.5 w-3.5" />,
          active: statusFilter === 'in_transit',
          onClick: toggleStatus('in_transit'),
        },
      ]}
      // 筛选器配置
      filters={[
        {
          key: 'status',
          label: '状态',
          options: Object.entries(FACTORY_SHIPMENT_STATUS_LABELS).map(
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
      }}
      onFilterChange={handleFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '发货日期',
        value: dateRange,
        onChange: handleDateRangeChange,
        placeholder: '选择发货日期',
      }}
      // 清空筛选
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="pro"
      compact={true}
    />
  );
}
