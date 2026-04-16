'use client';

/**
 * 出库记录搜索工具栏
 * 使用统一的 SearchFilterCard 组件
 *
 * ✅ 设计原则：
 * - KISS: 使用 SearchFilterCard 组件，避免重复造轮子
 * - DRY: 复用统一的搜索筛选组件
 * - 一致性: 与项目整体风格保持统一
 */

import {
  Building2,
  FlaskConical,
  PackageX,
  RefreshCw,
} from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { OUTBOUND_REASON_OPTIONS } from '@/lib/constants/inventory-filters';

interface OutboundRecordsSearchToolbarProps {
  /** 搜索关键词（受控） */
  searchValue: string;
  /** 出库原因筛选（'all' 表示全部） */
  typeFilter: string | 'all';
  /** 日期范围筛选 */
  dateRange: DateRangeValue;
  /** 输入框加载指示 */
  isSearching?: boolean;
  /** 搜索回调 */
  onSearch: (value: string) => void;
  /** 出库原因筛选回调 */
  onTypeChange: (value: string | 'all') => void;
  /** 日期范围变更 */
  onDateRangeChange: (range: DateRangeValue) => void;
  /** 清空筛选回调 */
  onClearFilters: () => void;
}

export const OutboundRecordsSearchToolbar =
  React.memo<OutboundRecordsSearchToolbarProps>(
    ({
      searchValue,
      typeFilter,
      dateRange,
      isSearching,
      onSearch,
      onTypeChange,
      onDateRangeChange,
      onClearFilters,
    }) => {
      const logic = useOutboundToolbarLogic({
        searchValue,
        typeFilter,
        dateRange,
        onTypeChange,
        onDateRangeChange,
        onClearFilters,
      });

      return (
        <OutboundToolbarView
          searchValue={searchValue}
          typeFilter={typeFilter}
          isSearching={isSearching}
          dateRange={dateRange}
          onSearch={onSearch}
          {...logic}
        />
      );
    }
  );

OutboundRecordsSearchToolbar.displayName = 'OutboundRecordsSearchToolbar';

function useOutboundToolbarLogic({
  searchValue,
  typeFilter,
  dateRange,
  onTypeChange,
  onDateRangeChange,
  onClearFilters,
}: Pick<
  OutboundRecordsSearchToolbarProps,
  | 'searchValue'
  | 'typeFilter'
  | 'dateRange'
  | 'onTypeChange'
  | 'onDateRangeChange'
  | 'onClearFilters'
>) {
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'type') {
        onTypeChange(value && value !== 'all' ? value : 'all');
      }
    },
    [onTypeChange]
  );

  const toggleType = React.useCallback(
    (type: string) => () => {
      onTypeChange(typeFilter === type ? 'all' : type);
    },
    [onTypeChange, typeFilter]
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
    typeFilter !== 'all' ||
    !!dateRange.startDate ||
    !!dateRange.endDate;

  return {
    handleFilterChange,
    toggleType,
    handleDateRangeChange,
    handleClearFilters,
    hasActiveFilters,
  } as const;
}

type OutboundToolbarViewProps = {
  searchValue: string;
  typeFilter: string | 'all';
  dateRange: DateRangeValue;
  isSearching?: boolean;
  onSearch: (value: string) => void;
  handleFilterChange: (key: string, value: string | undefined) => void;
  toggleType: (type: string) => () => void;
  handleDateRangeChange: (range: DateRangeValue) => void;
  handleClearFilters: () => void;
  hasActiveFilters: boolean;
};

function OutboundToolbarView({
  searchValue,
  typeFilter,
  dateRange,
  isSearching,
  onSearch,
  handleFilterChange,
  toggleType,
  handleDateRangeChange,
  handleClearFilters,
  hasActiveFilters,
}: OutboundToolbarViewProps) {
  return (
    <SearchFilterCard
      searchValue={searchValue}
      onSearchChange={onSearch}
      searchPlaceholder="搜索产品名称、编码、批次号..."
      isSearching={isSearching}
      // Toggle 按钮
      toggleButtons={[
        {
          key: 'sales_outbound',
          label: '销售出库',
          icon: <PackageX className="h-3.5 w-3.5" />,
          active: typeFilter === 'sales_outbound',
          onClick: toggleType('sales_outbound'),
        },
        {
          key: 'sample_outbound',
          label: '样品出库',
          icon: <FlaskConical className="h-3.5 w-3.5" />,
          active: typeFilter === 'sample_outbound',
          onClick: toggleType('sample_outbound'),
        },
        {
          key: 'internal_use_outbound',
          label: '内部领用',
          icon: <Building2 className="h-3.5 w-3.5" />,
          active: typeFilter === 'internal_use_outbound',
          onClick: toggleType('internal_use_outbound'),
        },
        {
          key: 'adjust_outbound',
          label: '调整出库',
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          active: typeFilter === 'adjust_outbound',
          onClick: toggleType('adjust_outbound'),
        },
      ]}
      // 筛选器配置
      filters={[
        {
          key: 'type',
          label: '出库原因',
          options: OUTBOUND_REASON_OPTIONS,
          width: 'w-full sm:w-40',
        },
      ]}
      filterValues={{
        type: typeFilter === 'all' ? 'all' : typeFilter,
      }}
      onFilterChange={handleFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '出库日期',
        value: dateRange,
        onChange: handleDateRangeChange,
        placeholder: '选择出库日期',
      }}
      // 清空筛选
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="pro"
      compact={true}
    />
  );
}
