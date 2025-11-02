'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Card, CardContent } from '@/components/ui/card';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import type {
  ReceivableItem,
  ReceivablesResult,
} from '@/lib/services/receivables-service';

import { ReceivablesTableList } from './ReceivablesTableList';
import type { ReceivablesQueryParams } from './types';

type ReceivablesFilterCardProps = {
  queryParams: ReceivablesQueryParams;
  isLoading: boolean;
  isSearching: boolean;
  error: unknown;
  receivables: ReceivableItem[];
  pagination?: ReceivablesResult['pagination'];
  searchValue: string;
  onSearch: (value: string) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  onDateRangeChange: (range: DateRangeValue) => void;
  onPageChange: (page: number) => void;
  onOpenPaymentDialog: (receivable: ReceivableItem) => void;
};

export function ReceivablesFilterCard({
  queryParams,
  isLoading,
  isSearching,
  error,
  receivables,
  pagination,
  searchValue,
  onSearch,
  onFilterChange,
  onDateRangeChange,
  onPageChange,
  onOpenPaymentDialog,
}: ReceivablesFilterCardProps) {
  const router = useRouter();
  const handleViewOrder = React.useCallback(
    (orderId: string) => router.push(`/sales-orders/${orderId}`),
    [router]
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <ReceivablesFilterBar
          queryParams={queryParams}
          searchValue={searchValue}
          isSearching={isSearching}
          onSearch={onSearch}
          onFilterChange={onFilterChange}
          onDateRangeChange={onDateRangeChange}
        />

      <div className="mt-6">
        <ReceivablesTableList
          isLoading={isLoading}
          error={error}
          receivables={receivables}
          pagination={pagination}
          onPageChange={onPageChange}
          onOpenPaymentDialog={onOpenPaymentDialog}
          onViewOrder={handleViewOrder}
        />
      </div>
      </CardContent>
    </Card>
  );
}

type ReceivablesFilterBarProps = {
  queryParams: ReceivablesQueryParams;
  searchValue: string;
  isSearching: boolean;
  onSearch: (value: string) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  onDateRangeChange: (range: DateRangeValue) => void;
};

function ReceivablesFilterBar({
  queryParams,
  searchValue,
  isSearching,
  onSearch,
  onFilterChange,
  onDateRangeChange,
}: ReceivablesFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-[280px] flex-1">
        <UnifiedSearchBar
          searchValue={searchValue}
          onSearchChange={onSearch}
          searchPlaceholder="搜索订单号或客户名称..."
          debounceDelay={0}
          showClearButton
          isSearching={isSearching}
          filters={[
            {
              key: 'paymentStatus',
              label: '状态',
              includeAllOption: true,
              options: [
                { label: '未收款', value: 'unpaid' },
                { label: '部分收款', value: 'partial' },
                { label: '待确认', value: 'pending' },
                { label: '已收款', value: 'paid' },
              ],
              width: 'w-[140px]',
            },
          ]}
          filterValues={{
            paymentStatus: queryParams.paymentStatus || 'all',
          }}
          onFilterChange={onFilterChange}
        />
      </div>
      <DateRangePicker
        value={{
          startDate: queryParams.startDate,
          endDate: queryParams.endDate,
        }}
        onChange={onDateRangeChange}
        label=""
        placeholder="选择订单日期范围"
        showPresets
        className="min-w-[220px]"
      />
    </div>
  );
}
