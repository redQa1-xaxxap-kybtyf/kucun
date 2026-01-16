'use client';

import { Ban, Eye } from 'lucide-react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import {
  EXPENSE_RELATED_TYPE_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
  type ExpenseQueryParams,
} from '@/lib/types/expense';

interface ExpenseFiltersProps {
  filters: ExpenseQueryParams;
  onFilterChange: (filters: Partial<ExpenseQueryParams>) => void;
}

export function ExpenseFilters({
  filters,
  onFilterChange,
}: ExpenseFiltersProps) {
  const handleIncludeTestToggle = () => {
    onFilterChange({ includeTest: filters.includeTest ? undefined : true });
  };

  const handleIncludeVoidedToggle = () => {
    onFilterChange({ includeVoided: filters.includeVoided ? undefined : true });
  };

  return (
    <SearchFilterCard
      searchValue=""
      onSearchChange={() => {}}
      toggleButtons={[
        {
          key: 'includeTest',
          label: '显示测试',
          icon: <Eye className="h-3.5 w-3.5" />,
          active: !!filters.includeTest,
          onClick: handleIncludeTestToggle,
        },
        {
          key: 'includeVoided',
          label: '显示作废',
          icon: <Ban className="h-3.5 w-3.5" />,
          active: !!filters.includeVoided,
          onClick: handleIncludeVoidedToggle,
        },
      ]}
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
      variant="pro"
      compact={true}
    />
  );
}
