import { SearchFilterCard } from '@/components/common/search-filter-card';
import { COUNT_TYPE_OPTIONS } from '@/lib/constants/inventory-filters';
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
  // 处理筛选变更
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (key === 'countType') {
      onFiltersChange({
        countType: value as InventoryCountQueryParams['countType'],
      });
    }
  };

  return (
    <SearchFilterCard
      searchValue={filters.location || ''}
      onSearchChange={(val) => onFiltersChange({ location: val })}
      searchPlaceholder="搜索盘点位置..."
      // 筛选器配置
      filters={[
        {
          key: 'countType',
          label: '盘点类型',
          options: COUNT_TYPE_OPTIONS,
          width: 'w-40',
        },
      ]}
      filterValues={{
        countType: filters.countType || 'all',
      }}
      onFilterChange={handleFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '盘点日期',
        value: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
        onChange: ({ startDate, endDate }) => {
          onFiltersChange({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          });
        },
        placeholder: '选择盘点日期范围',
      }}
      onClearFilters={onReset}
      hasActiveFilters={
        !!filters.location ||
        !!filters.countType ||
        !!filters.startDate ||
        !!filters.endDate
      }
      variant="pro"
      compact={true}
    />
  );
}
