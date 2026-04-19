'use client';

import { useRouter } from 'next/navigation';

import { PayableList } from '@/components/finance/payables-client/PayableList';
import { PayablesFilterBar } from '@/components/finance/payables-client/PayablesFilterBar';
import { PayablesSummary } from '@/components/finance/payables-client/PayablesSummary';
import { usePayablesController } from '@/components/finance/payables-client/usePayablesController';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { Pagination } from '@/components/ui/pagination';
import type { PayableRecordQuery } from '@/lib/types/payable';

interface PayablesClientProps {
  initialStatistics: {
    totalPayables: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
    pendingCount: number;
    partialCount: number;
    paidCount: number;
  };
  initialParams?: PayableRecordQuery;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onPageChange?: (page: number) => void;
  searchValue?: string;
  isSearching?: boolean;
  onClearFilters?: () => void;
}

export function PayablesClient({
  initialStatistics,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onDateRangeChange: externalOnDateRangeChange,
  onPageChange: externalOnPageChange,
  searchValue,
  isSearching = false,
  onClearFilters,
}: PayablesClientProps) {
  const router = useRouter();

  const {
    query,
    payables,
    pagination,
    isLoading: payablesLoading,
    handleSearch,
    handleFilterChange,
    handleDateRangeChange,
    handlePageChange,
  } = usePayablesController({
    initialParams,
    onSearch: externalOnSearch,
    onFilter: externalOnFilter,
    onDateRangeChange: externalOnDateRangeChange,
    onPageChange: externalOnPageChange,
    isSearchControlled: searchValue !== undefined,
  });

  const effectiveSearchValue = searchValue ?? query.search ?? initialParams?.search ?? '';

  return (
    <div className="space-y-6">
      {/* ✅ 传递当前筛选条件给统计组件，实现动态更新 */}
      <PayablesSummary filters={query} initialStatistics={initialStatistics} />

      <Card className="border border-[hsl(var(--color-border-secondary))]">
        <CardContent className="pt-6">
          <PayablesFilterBar
            query={query}
            searchValue={effectiveSearchValue}
            isSearching={isSearching}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            onDateRangeChange={handleDateRangeChange}
            onClearFilters={onClearFilters}
          />

          <div className="mt-6">
            <PayableList
              items={payables}
              isLoading={payablesLoading}
              onView={id => router.push(`/finance/payables/${id}`)}
              onPayNow={id =>
                router.push(`/finance/payments-out/create?payableId=${id}`)
              }
            />
          </div>

          {pagination && (
            <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
              <Pagination
                pagination={pagination}
                onPageChange={handlePageChange}
                showRange
                showTotal
                disabled={payablesLoading}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
