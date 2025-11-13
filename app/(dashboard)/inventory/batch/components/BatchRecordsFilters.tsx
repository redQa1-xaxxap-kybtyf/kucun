/**
 * 批次管理筛选组件
 * 使用统一的RecordsFilters组件，遵循唯一真理原则
 */

'use client';

import {
  BATCH_FILTER_CONFIG,
  RecordsFilters,
  type FilterValues,
} from '@/components/inventory/forms/RecordsFilters';
import type { BatchSpecificationQueryParams } from '@/lib/types/batch-specification';

interface BatchRecordsFiltersProps {
  filters: BatchSpecificationQueryParams;
  onFiltersChange: (filters: Partial<BatchSpecificationQueryParams>) => void;
  onReset: () => void;
}

export function BatchRecordsFilters({
  filters,
  onFiltersChange,
  onReset,
}: BatchRecordsFiltersProps) {
  // 将filters转换为FilterValues格式
  const filterValues: FilterValues = {
    search: filters.search,
    type: undefined, // 批次管理不需要类型筛选
    startDate: undefined, // 批次管理暂不支持日期范围筛选
    endDate: undefined,
  };

  // 处理筛选变更
  const handleFilterChange = (
    key: keyof FilterValues,
    value: string | undefined
  ) => {
    // 将FilterValues的key映射到BatchSpecificationQueryParams的key
    if (key === 'search') {
      onFiltersChange({
        search: value,
        page: 1, // 重置到第一页
      });
    }
  };

  return (
    <RecordsFilters
      config={BATCH_FILTER_CONFIG}
      values={filterValues}
      onFilterChange={handleFilterChange}
      onReset={onReset}
    />
  );
}
