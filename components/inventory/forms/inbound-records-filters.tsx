/**
 * 入库记录筛选组件
 * 使用统一的RecordsFilters组件，遵循唯一真理原则
 */

'use client';

import type { InboundQueryParams } from '@/lib/types/inbound';

import {
  INBOUND_FILTER_CONFIG,
  RecordsFilters,
  type FilterValues,
} from './RecordsFilters';

interface InboundRecordsFiltersProps {
  queryParams: InboundQueryParams;
  onFilter: (key: keyof InboundQueryParams, value: string | undefined) => void;
  onReset: () => void;
}

export function InboundRecordsFilters({
  queryParams,
  onFilter,
  onReset,
}: InboundRecordsFiltersProps) {
  // 将queryParams转换为FilterValues格式
  const filterValues: FilterValues = {
    search: queryParams.productId,
    type: queryParams.reason,
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
  };

  // 处理筛选变更
  const handleFilterChange = (
    key: keyof FilterValues,
    value: string | undefined
  ) => {
    // 将FilterValues的key映射到InboundQueryParams的key
    const keyMap: Record<keyof FilterValues, keyof InboundQueryParams> = {
      search: 'productId',
      type: 'reason',
      startDate: 'startDate',
      endDate: 'endDate',
    };

    const mappedKey = keyMap[key];
    if (mappedKey) {
      onFilter(mappedKey, value);
    }
  };

  return (
    <RecordsFilters
      config={INBOUND_FILTER_CONFIG}
      values={filterValues}
      onFilterChange={handleFilterChange}
      onReset={onReset}
    />
  );
}
