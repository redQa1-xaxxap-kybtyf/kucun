/**
 * 库存调整记录筛选组件
 * 使用统一的RecordsFilters组件，遵循唯一真理原则
 */

'use client';

import {
  ADJUSTMENT_FILTER_CONFIG,
  RecordsFilters,
  type FilterValues,
} from '@/components/inventory/forms/RecordsFilters';
import type { AdjustmentQueryParams } from '@/lib/types/inventory';

interface AdjustmentRecordsFiltersProps {
  filters: AdjustmentQueryParams;
  onFiltersChange: (filters: AdjustmentQueryParams) => void;
  onReset: () => void;
}

export function AdjustmentRecordsFilters({
  filters,
  onFiltersChange,
  onReset,
}: AdjustmentRecordsFiltersProps) {
  // 将filters转换为FilterValues格式
  const filterValues: FilterValues = {
    search: filters?.search,
    type: filters?.reason,
    startDate: filters?.startDate,
    endDate: filters?.endDate,
  };

  // 处理筛选变更
  const handleFilterChange = (
    key: keyof FilterValues,
    value: string | undefined
  ) => {
    // 将FilterValues的key映射到AdjustmentQueryParams的key
    const keyMap: Record<
      keyof FilterValues,
      keyof AdjustmentQueryParams | null
    > = {
      search: 'search',
      type: 'reason',
      startDate: 'startDate',
      endDate: 'endDate',
    };

    const mappedKey = keyMap[key];
    if (mappedKey) {
      onFiltersChange({
        ...filters,
        [mappedKey]: value,
        page: 1, // 重置到第一页
      });
    }
  };

  return (
    <RecordsFilters
      config={ADJUSTMENT_FILTER_CONFIG}
      values={filterValues}
      onFilterChange={handleFilterChange}
      onReset={onReset}
    />
  );
}
