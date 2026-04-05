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
import {
  INBOUND_DAMAGE_FILTER_OPTIONS,
  INBOUND_REASON_OPTIONS,
} from '@/lib/constants/inventory-filters';

interface InboundRecordsSearchToolbarProps {
  /** 搜索关键词（受控） */
  searchValue: string;
  /** 入库原因筛选（'all' 表示全部） */
  reasonFilter: string | 'all';
  /** 破损筛选（'all' 表示全部） */
  damageFilter: 'all' | 'damaged';
  /** 日期范围筛选 */
  dateRange: DateRangeValue;
  /** 输入框加载指示 */
  isSearching?: boolean;
  /** 搜索回调 */
  onSearch: (value: string) => void;
  /** 入库原因筛选回调 */
  onReasonChange: (value: string | 'all') => void;
  /** 破损筛选回调 */
  onDamageChange: (value: 'all' | 'damaged') => void;
  /** 日期范围变更 */
  onDateRangeChange: (range: DateRangeValue) => void;
  /** 清空筛选回调 */
  onClearFilters: () => void;
}

export const InboundRecordsSearchToolbar =
  React.memo<InboundRecordsSearchToolbarProps>(
    ({
      searchValue,
      reasonFilter,
      damageFilter,
      dateRange,
      isSearching,
      onSearch,
      onReasonChange,
      onDamageChange,
      onDateRangeChange,
      onClearFilters,
    }) => {
      const logic = useInboundToolbarLogic({
        searchValue,
        reasonFilter,
        damageFilter,
        dateRange,
        onReasonChange,
        onDamageChange,
        onDateRangeChange,
        onClearFilters,
      });

      return (
        <InboundToolbarView
          searchValue={searchValue}
          reasonFilter={reasonFilter}
          damageFilter={damageFilter}
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
  searchValue,
  reasonFilter,
  damageFilter,
  dateRange,
  onReasonChange,
  onDamageChange,
  onDateRangeChange,
  onClearFilters,
}: Pick<
  InboundRecordsSearchToolbarProps,
  | 'searchValue'
  | 'reasonFilter'
  | 'damageFilter'
  | 'dateRange'
  | 'onReasonChange'
  | 'onDamageChange'
  | 'onDateRangeChange'
  | 'onClearFilters'
>) {
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'reason') {
        onReasonChange(value && value !== 'all' ? value : 'all');
        return;
      }

      if (key === 'hasDamage') {
        onDamageChange(value === 'damaged' ? 'damaged' : 'all');
      }
    },
    [onDamageChange, onReasonChange]
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
    !!searchValue.trim() ||
    reasonFilter !== 'all' ||
    damageFilter !== 'all' ||
    !!dateRange.startDate ||
    !!dateRange.endDate;

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
  damageFilter: 'all' | 'damaged';
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
  damageFilter,
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
          options: INBOUND_REASON_OPTIONS,
          width: 'w-full sm:w-40',
        },
        {
          key: 'hasDamage',
          label: '破损情况',
          options: INBOUND_DAMAGE_FILTER_OPTIONS,
          width: 'w-full sm:w-40',
        },
      ]}
      filterValues={{
        reason: reasonFilter === 'all' ? 'all' : reasonFilter,
        hasDamage: damageFilter === 'damaged' ? 'damaged' : 'all',
      }}
      onFilterChange={handleFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '入库周期',
        value: dateRange,
        onChange: handleDateRangeChange,
        placeholder: '起始日期至结束日期',
      }}
      // 清空筛选
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="pro"
      compact={true}
    />
  );
}
