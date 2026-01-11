import { SearchFilterCard } from '@/components/common/search-filter-card';
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
  return (
    <SearchFilterCard
      searchValue={filters.search || ''}
      onSearchChange={(val) => onFiltersChange({ search: val, page: 1 })}
      searchPlaceholder="搜索批次号、产品名称、编码..."
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '创建日期',
        value: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
        onChange: ({ startDate, endDate }) => {
          onFiltersChange({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            page: 1,
          });
        },
        placeholder: '选择批次日期范围',
      }}
      onClearFilters={onReset}
      hasActiveFilters={
        !!filters.search || !!filters.startDate || !!filters.endDate
      }
      variant="pro"
      compact={true}
    />
  );
}
