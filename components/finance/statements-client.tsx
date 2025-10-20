'use client';

import * as React from 'react';

import type { DateRangeValue } from '@/components/ui/date-range-picker';

import { StatementsFilterSection } from './statements-filter-section';
import { StatementsSummaryCards } from './statements-summary-cards';
import type {
  AccountStatementItem,
  StatementsClientInitialParams,
  StatementsFilters,
  StatementsFiltersState,
  StatementsPagination,
  StatementsSummary,
} from './statements-types';

export interface StatementsClientProps {
  initialData: {
    statements: AccountStatementItem[];
    summary: StatementsSummary;
    pagination: StatementsPagination;
  };
  initialParams?: StatementsClientInitialParams;
  filters?: StatementsFilters;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onPageChange?: (page: number) => void;
}

export function StatementsClient({
  initialData,
  initialParams,
  filters,
  onSearch,
  onFilter,
  onDateRangeChange,
  onPageChange,
}: StatementsClientProps) {
  const { statements, summary, pagination } = initialData;
  const effectiveFilters: StatementsFiltersState = {
    search: filters?.search ?? initialParams?.search ?? '',
    type: filters?.type ?? initialParams?.type ?? 'all',
    sortBy: filters?.sortBy ?? initialParams?.sortBy ?? 'totalAmount',
    sortOrder: filters?.sortOrder ?? initialParams?.sortOrder ?? 'desc',
    startDate: filters?.startDate ?? initialParams?.startDate,
    endDate: filters?.endDate ?? initialParams?.endDate,
  };

  const handleDateRangeChange = React.useCallback(
    (range: DateRangeValue) => {
      onDateRangeChange?.(range);
    },
    [onDateRangeChange]
  );

  return (
    <div className="space-y-4">
      <StatementsSummaryCards summary={summary} />
      <StatementsFilterSection
        filters={effectiveFilters}
        statements={statements}
        pagination={pagination}
        onSearch={onSearch}
        onFilter={onFilter}
        onDateRangeChange={handleDateRangeChange}
        onPageChange={onPageChange}
      />
    </div>
  );
}

export type { AccountStatementItem } from './statements-types';
export { STATUS_LABEL_MAP, TYPE_LABEL_MAP } from './statements-types';
