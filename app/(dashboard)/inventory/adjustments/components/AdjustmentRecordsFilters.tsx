import { SearchFilterCard } from '@/components/common/search-filter-card';
import { ADJUSTMENT_REASON_OPTIONS } from '@/lib/constants/inventory-filters';
import type {
    AdjustmentQueryParams,
    AdjustmentReason,
} from '@/lib/types/inventory';

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
  // 将筛选变更逻辑映射回状态更新
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (key === 'reason') {
      onFiltersChange({
        ...filters,
        reason: value as AdjustmentReason | undefined,
        page: 1,
      });
    }
  };

  return (
    <SearchFilterCard
      searchValue={filters?.search || ''}
      onSearchChange={(val) =>
        onFiltersChange({ ...filters, search: val, page: 1 })
      }
      searchPlaceholder="搜索调整单号、产品名称、编码..."
      // 筛选器配置
      filters={[
        {
          key: 'reason',
          label: '调整原因',
          options: ADJUSTMENT_REASON_OPTIONS,
          width: 'w-40',
        },
      ]}
      filterValues={{
        reason: filters?.reason || 'all',
      }}
      onFilterChange={handleFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '调整日期',
        value: {
          startDate: filters?.startDate,
          endDate: filters?.endDate,
        },
        onChange: ({ startDate, endDate }) => {
          onFiltersChange({
            ...filters,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            page: 1,
          });
        },
        placeholder: '选择调整日期范围',
      }}
      onClearFilters={onReset}
      hasActiveFilters={
        !!filters?.search ||
        !!filters?.reason ||
        !!filters?.startDate ||
        !!filters?.endDate
      }
      variant="pro"
      compact={true}
    />
  );
}
