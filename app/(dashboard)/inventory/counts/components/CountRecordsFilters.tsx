import { SearchFilterCard } from '@/components/common/search-filter-card';
import { Input } from '@/components/ui/input';
import {
  COUNT_STATUS_OPTIONS,
  COUNT_TYPE_OPTIONS,
  type InventoryCountQueryParams,
} from '@/lib/types/inventory-count';

interface CountRecordsFiltersProps {
  filters: InventoryCountQueryParams;
  searchValue?: string;
  isSearching?: boolean;
  onSearchChange?: (value: string) => void;
  onFiltersChange: (filters: Partial<InventoryCountQueryParams>) => void;
  onReset: () => void;
}

export function CountRecordsFilters({
  filters,
  searchValue,
  isSearching = false,
  onSearchChange,
  onFiltersChange,
  onReset,
}: CountRecordsFiltersProps) {
  // 处理筛选变更
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (key === 'countType') {
      onFiltersChange({
        countType: value as InventoryCountQueryParams['countType'],
      });
      return;
    }

    if (key === 'status') {
      onFiltersChange({
        status: value as InventoryCountQueryParams['status'],
      });
    }
  };

  return (
    <SearchFilterCard
      searchValue={searchValue ?? (filters.search || '')}
      onSearchChange={val =>
        onSearchChange ? onSearchChange(val) : onFiltersChange({ search: val })
      }
      searchPlaceholder="搜索盘点单名称、编号..."
      isSearching={isSearching}
      // 筛选器配置
      filters={[
        {
          key: 'status',
          label: '盘点状态',
          options: COUNT_STATUS_OPTIONS,
          width: 'w-36',
        },
        {
          key: 'countType',
          label: '盘点类型',
          options: COUNT_TYPE_OPTIONS,
          width: 'w-40',
        },
      ]}
      filterValues={{
        status: filters.status || 'all',
        countType: filters.countType || 'all',
      }}
      onFilterChange={handleFilterChange}
      customFilters={
        <Input
          aria-label="库位/存放区域"
          value={filters.location || ''}
          onChange={event =>
            onFiltersChange({
              location: event.target.value || undefined,
            })
          }
          placeholder="库位/存放区域"
          className="h-11 w-full rounded-lg border-[hsl(var(--color-border-primary))] bg-white font-medium sm:w-48"
        />
      }
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
        !!filters.search ||
        !!filters.location ||
        !!filters.status ||
        !!filters.countType ||
        !!filters.startDate ||
        !!filters.endDate
      }
      variant="pro"
      compact={true}
    />
  );
}
