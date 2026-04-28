'use client';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import {
  EXPENSE_RELATED_TYPE_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
  type ExpenseQueryParams,
} from '@/lib/types/expense';

interface ExpenseFiltersProps {
  filters: ExpenseQueryParams;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
  onFilterChange: (filters: Partial<ExpenseQueryParams>) => void;
  onClearFilters?: () => void;
}

export function ExpenseFilters({
  filters,
  searchValue,
  onSearchChange,
  isSearching = false,
  onFilterChange,
  onClearFilters,
}: ExpenseFiltersProps) {
  return (
    <SearchFilterCard
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="搜索费用单号、费用名称、关联单号、备注"
      isSearching={isSearching}
      // 筛选器配置
      filters={[
        {
          key: 'expenseType',
          label: '费用类型',
          options: EXPENSE_TYPE_OPTIONS.map(option => ({
            label: option.label,
            value: option.value,
          })),
          width: 'w-[140px]',
        },
        {
          key: 'relatedType',
          label: '关联业务',
          options: EXPENSE_RELATED_TYPE_OPTIONS.map(option => ({
            label: option.label,
            value: option.value,
          })),
          width: 'w-[140px]',
        },
      ]}
      filterValues={{
        expenseType: filters.expenseType || 'all',
        relatedType: filters.relatedType || 'all',
      }}
      onFilterChange={(key, value) => {
        onFilterChange({
          [key]: value === 'all' ? undefined : value,
        });
      }}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '日期范围',
        value: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
        onChange: ({ startDate, endDate }) => {
          onFilterChange({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          });
        },
        placeholder: '选择日期范围',
      }}
      toggleButtons={[
        {
          key: 'includeVoided',
          label: '显示已作废',
          active: !!filters.includeVoided,
          onClick: () => {
            onFilterChange({
              includeVoided: filters.includeVoided ? undefined : true,
            });
          },
        },
      ]}
      onClearFilters={onClearFilters}
      variant="pro"
      compact={true}
    />
  );
}
