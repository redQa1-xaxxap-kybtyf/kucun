/**
 * 出库记录筛选组件
 * 使用统一的RecordsFilters组件，遵循唯一真理原则
 */

'use client';

import type { OutboundType } from '@/lib/types/inventory';

import {
  OUTBOUND_FILTER_CONFIG,
  RecordsFilters,
  type FilterValues,
} from './RecordsFilters';

interface OutboundFilters {
  startDate: string;
  endDate: string;
  type: OutboundType | '';
  search?: string;
}

interface OutboundRecordsFiltersProps {
  filters: OutboundFilters;
  onUpdateFilter: (key: keyof OutboundFilters, value: string) => void;
  onReset: () => void;
}

export function OutboundRecordsFilters({
  filters,
  onUpdateFilter,
  onReset,
}: OutboundRecordsFiltersProps) {
  // 将filters转换为FilterValues格式
  const filterValues: FilterValues = {
    search: filters.search,
    type: filters.type === '' ? undefined : filters.type,
    startDate: filters.startDate,
    endDate: filters.endDate,
  };

  // 处理筛选变更
  const handleFilterChange = (
    key: keyof FilterValues,
    value: string | undefined
  ) => {
    onUpdateFilter(key as keyof OutboundFilters, value || '');
  };

  return (
    <RecordsFilters
      config={OUTBOUND_FILTER_CONFIG}
      values={filterValues}
      onFilterChange={handleFilterChange}
      onReset={onReset}
    />
  );
}
