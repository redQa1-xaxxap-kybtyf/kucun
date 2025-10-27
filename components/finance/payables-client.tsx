'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PaginationBar } from '@/components/finance/payables-client/PaginationBar';
import { PayableList } from '@/components/finance/payables-client/PayableList';
import { PayablesFilterBar } from '@/components/finance/payables-client/PayablesFilterBar';
import { PayablesSummary } from '@/components/finance/payables-client/PayablesSummary';
import { usePayablesController } from '@/components/finance/payables-client/usePayablesController';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
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
}

export function PayablesClient({
  initialStatistics,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onDateRangeChange: externalOnDateRangeChange,
  onPageChange: externalOnPageChange,
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
  });

  return (
    <div className="space-y-6">
      <PayablesSummary statistics={initialStatistics} />

      <Card className="border border-[hsl(var(--color-border-secondary))]">
        <CardContent className="pt-6">
          <PayablesFilterBar
            query={query}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            onDateRangeChange={handleDateRangeChange}
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

          <PaginationBar
            page={query.page || 1}
            totalPages={pagination?.totalPages || 1}
            total={pagination?.total || 0}
            isLoading={payablesLoading}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
