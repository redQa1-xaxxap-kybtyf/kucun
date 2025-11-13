'use client';

/**
 * 入库记录搜索工具栏
 * 使用统一的 SearchFilterCard 组件
 *
 * ✅ 设计原则：
 * - KISS: 使用 SearchFilterCard 组件，避免重复造轮子
 * - DRY: 复用统一的搜索筛选组件
 * - 一致性: 与项目整体风格保持统一
 */

import { Package, RefreshCw } from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';

interface InboundRecordsSearchToolbarProps {
  /** 搜索关键词（受控） */
  searchValue: string;
  /** 入库原因筛选（'all' 表示全部） */
  reasonFilter: string | 'all';
  /** 日期范围筛选 */
  dateRange: DateRangeValue;
  /** 输入框加载指示 */
  isSearching?: boolean;
  /** 搜索回调 */
  onSearch: (value: string) => void;
  /** 入库原因筛选回调 */
  onReasonChange: (value: string | 'all') => void;
  /** 日期范围变更 */
  onDateRangeChange: (range: DateRangeValue) => void;
  /** 清空筛选回调 */
  onClearFilters: () => void;
}

/**
 * 入库原因标签映射
 */
const INBOUND_REASON_LABELS: Record<string, string> = {
  purchase: '采购入库',
  return: '退货入库',
  transfer: '调拨入库',
  surplus: '盘盈入库',
  other: '其他',
  sales_cancel: '销售订单取消入库',
  return_inbound: '退货订单入库',
};

export const InboundRecordsSearchToolbar =
  React.memo<InboundRecordsSearchToolbarProps>(
    ({
      searchValue,
      reasonFilter,
      dateRange,
      isSearching,
      onSearch,
      onReasonChange,
      onDateRangeChange,
      onClearFilters,
    }) => {
      const logic = useInboundToolbarLogic({
        reasonFilter,
        dateRange,
        onReasonChange,
        onDateRangeChange,
        onClearFilters,
      });

      return (
        <InboundToolbarView
          searchValue={searchValue}
          reasonFilter={reasonFilter}
          isSearching={isSearching}
          dateRange={dateRange}
          onSearch={onSearch}
          {...logic}
        />
      );
    }
  );

InboundRecordsSearchToolbar.displayName = 'InboundRecordsSearchToolbar';

function useInboundToolbarLogic({
  reasonFilter,
  dateRange,
  onReasonChange,
  onDateRangeChange,
  onClearFilters,
}: Pick<
  InboundRecordsSearchToolbarProps,
  | 'reasonFilter'
  | 'dateRange'
  | 'onReasonChange'
  | 'onDateRangeChange'
  | 'onClearFilters'
>) {
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'reason') {
        onReasonChange(value && value !== 'all' ? value : 'all');
      }
    },
    [onReasonChange]
  );

  const toggleReason = React.useCallback(
    (reason: string) => () => {
      onReasonChange(reasonFilter === reason ? 'all' : reason);
    },
    [onReasonChange, reasonFilter]
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
    reasonFilter !== 'all' || !!dateRange.startDate || !!dateRange.endDate;

  return {
    handleFilterChange,
    toggleReason,
    handleDateRangeChange,
    handleClearFilters,
    hasActiveFilters,
  } as const;
}

type InboundToolbarViewProps = {
  searchValue: string;
  reasonFilter: string | 'all';
  dateRange: DateRangeValue;
  isSearching?: boolean;
  onSearch: (value: string) => void;
  handleFilterChange: (key: string, value: string | undefined) => void;
  toggleReason: (reason: string) => () => void;
  handleDateRangeChange: (range: DateRangeValue) => void;
  handleClearFilters: () => void;
  hasActiveFilters: boolean;
};

function InboundToolbarView({
  searchValue,
  reasonFilter,
  dateRange,
  isSearching,
  onSearch,
  handleFilterChange,
  toggleReason,
  handleDateRangeChange,
  handleClearFilters,
  hasActiveFilters,
}: InboundToolbarViewProps) {
  return (
    <SearchFilterCard
      searchValue={searchValue}
      onSearchChange={onSearch}
      searchPlaceholder="搜索产品名称、编码、批次号..."
      isSearching={isSearching}
      // Toggle 按钮
      toggleButtons={[
        {
          key: 'purchase',
          label: '采购入库',
          icon: <Package className="h-3.5 w-3.5" />,
          active: reasonFilter === 'purchase',
          onClick: toggleReason('purchase'),
        },
        {
          key: 'return',
          label: '退货入库',
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          active: reasonFilter === 'return',
          onClick: toggleReason('return'),
        },
      ]}
      // 筛选器配置
      filters={[
        {
          key: 'reason',
          label: '入库原因',
          options: Object.entries(INBOUND_REASON_LABELS).map(
            ([value, label]) => ({
              label,
              value,
            })
          ),
          width: 'w-full sm:w-40',
        },
      ]}
      filterValues={{
        reason: reasonFilter === 'all' ? 'all' : reasonFilter,
      }}
      onFilterChange={handleFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '入库日期',
        value: dateRange,
        onChange: handleDateRangeChange,
        placeholder: '选择入库日期',
      }}
      // 清空筛选
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="elevated"
    />
  );
}
