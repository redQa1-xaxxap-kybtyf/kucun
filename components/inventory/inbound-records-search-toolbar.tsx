'use client';

/**
 * 入库记录搜索工具栏
 * 对齐厂家发货页面的优秀方案，复用统一搜索栏并支持快捷筛选、日期范围与清空筛选
 *
 * ✅ 设计原则：
 * - KISS: 使用 UnifiedSearchBar 组件，避免重复造轮子
 * - DRY: 复用厂家发货页面的成功模式
 * - 一致性: 与项目整体风格保持统一
 */

import { Filter, Package, RefreshCw } from 'lucide-react';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';

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
    <Card
      className="border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-light)' }}
    >
      <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <UnifiedSearchBar
            searchValue={searchValue}
            onSearchChange={onSearch}
            searchPlaceholder="搜索产品名称、编码、批次号..."
            debounceDelay={0}
            compact
            isSearching={isSearching}
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
            filters={[
              {
                key: 'reason',
                label: '入库原因',
                includeAllOption: true,
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
          />

          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            label=""
            placeholder="选择入库日期"
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
