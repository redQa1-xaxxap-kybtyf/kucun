/**
 * 库存盘点记录筛选组件
 * 使用统一的RecordsFilters组件，遵循唯一真理原则
 */

'use client';

import {
  COUNT_FILTER_CONFIG,
  RecordsFilters,
  type FilterValues,
} from '@/components/inventory/forms/RecordsFilters';
import type { InventoryCountQueryParams } from '@/lib/types/inventory-count';

interface CountRecordsFiltersProps {
  filters: InventoryCountQueryParams;
  onFiltersChange: (filters: Partial<InventoryCountQueryParams>) => void;
  onReset: () => void;
}

export function CountRecordsFilters({
  filters,
  onFiltersChange,
  onReset,
}: CountRecordsFiltersProps) {
  // 将filters转换为FilterValues格式
  const filterValues: FilterValues = {
    search: filters.location, // 使用 location 字段作为搜索
    type: filters.countType,
    startDate: filters.startDate,
    endDate: filters.endDate,
  };

  // 处理筛选变更
  const handleFilterChange = (
    key: keyof FilterValues,
    value: string | undefined
  ) => {
    // 将FilterValues的key映射到InventoryCountQueryParams的key
    if (key === 'search') {
      onFiltersChange({
        location: value,
      });
    } else if (key === 'type') {
      onFiltersChange({
        countType: value as InventoryCountQueryParams['countType'],
      });
    } else if (key === 'startDate') {
      onFiltersChange({
        startDate: value,
      });
    } else if (key === 'endDate') {
      onFiltersChange({
        endDate: value,
      });
    }
  };

  return (
    <RecordsFilters
      config={COUNT_FILTER_CONFIG}
      values={filterValues}
      onFilterChange={handleFilterChange}
      onReset={onReset}
    />
  );
}
