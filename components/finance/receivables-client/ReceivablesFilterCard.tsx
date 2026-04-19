'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
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
  onClearFilters: () => void;
  onOpenPaymentDialog: (receivable: ReceivableItem) => void;
  onRetry: () => void;
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
  onClearFilters,
  onOpenPaymentDialog,
  onRetry,
}: ReceivablesFilterCardProps) {
  const router = useRouter();
  const handleViewOrder = React.useCallback(
    (orderId: string) => router.push(`/sales-orders/${orderId}`),
    [router]
  );

  return (
    <div className="space-y-6">
      <ReceivablesFilterBar
        queryParams={queryParams}
        searchValue={searchValue}
        isSearching={isSearching}
        onSearch={onSearch}
        onFilterChange={onFilterChange}
        onDateRangeChange={onDateRangeChange}
        onClearFilters={onClearFilters}
      />

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <ReceivablesTableList
          isLoading={isLoading}
          error={error}
          receivables={receivables}
          pagination={pagination}
          onPageChange={onPageChange}
          onOpenPaymentDialog={onOpenPaymentDialog}
          onViewOrder={handleViewOrder}
          onRetry={onRetry}
        />
      </div>
    </div>
  );
}

type ReceivablesFilterBarProps = {
  queryParams: ReceivablesQueryParams;
  searchValue: string;
  isSearching: boolean;
  onSearch: (value: string) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
  onDateRangeChange: (range: DateRangeValue) => void;
  onClearFilters: () => void;
};

function ReceivablesFilterBar({
  queryParams,
  searchValue,
  isSearching,
  onSearch,
  onFilterChange,
  onDateRangeChange,
  onClearFilters,
}: ReceivablesFilterBarProps) {
  const hasActiveFilters =
    Boolean(searchValue.trim()) ||
    Boolean(queryParams.paymentStatus) ||
    Boolean(queryParams.startDate) ||
    Boolean(queryParams.endDate);

  return (
    <SearchFilterCard
      searchValue={searchValue}
      onSearchChange={onSearch}
      searchPlaceholder="搜索订单号或客户名称..."
      isSearching={isSearching}
      // 筛选器配置
      filters={[
        {
          key: 'paymentStatus',
          label: '状态',
          options: [
            { label: '未收款', value: 'unpaid' },
            { label: '部分收款', value: 'partial' },
            { label: '待确认到账', value: 'pending' },
            { label: '已收款', value: 'paid' },
          ],
          width: 'w-[140px]',
        },
      ]}
      filterValues={{
        paymentStatus: queryParams.paymentStatus || 'all',
      }}
      onFilterChange={onFilterChange}
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '订单日期',
        value: {
          startDate: queryParams.startDate,
          endDate: queryParams.endDate,
        },
        onChange: onDateRangeChange,
        placeholder: '选择订单日期范围',
      }}
      onClearFilters={onClearFilters}
      hasActiveFilters={hasActiveFilters}
      variant="pro"
      compact={true}
    />
  );
}
