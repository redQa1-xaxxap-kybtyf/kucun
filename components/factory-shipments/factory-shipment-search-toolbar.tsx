'use client';

/**
 * 厂家发货搜索工具栏
 * 对齐库存模块的优秀方案，复用统一搜索栏并支持快捷筛选、日期范围与清空筛选
 */

import { Clock, Filter, Truck } from 'lucide-react';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
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
  statusFilter,
  dateRange,
  onStatusChange,
  onDateRangeChange,
  onClearFilters,
}: Pick<
  FactoryShipmentSearchToolbarProps,
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
    statusFilter !== 'all' || !!dateRange.startDate || !!dateRange.endDate;

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
    <Card
      className="border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-light)' }}
    >
      <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <UnifiedSearchBar
            searchValue={searchValue}
            onSearchChange={onSearch}
            searchPlaceholder="搜索集装箱号码或订单编号..."
            debounceDelay={0}
            compact
            isSearching={isSearching}
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
            filters={[
              {
                key: 'status',
                label: '状态',
                includeAllOption: true,
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
          />

          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            label=""
            placeholder="选择发货日期"
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
