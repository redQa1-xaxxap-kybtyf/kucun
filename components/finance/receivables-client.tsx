'use client';

import { ReceivablePaymentDialog } from '@/components/finance/receivable-payment-dialog';
import { ReceivablesFilterCard } from '@/components/finance/receivables-client/ReceivablesFilterCard';
import { ReceivablesSummaryCards } from '@/components/finance/receivables-client/ReceivablesSummaryCards';
import type { ReceivablesQueryParams } from '@/components/finance/receivables-client/types';
import { useReceivablesController } from '@/components/finance/receivables-client/useReceivablesController';
import type { ReceivablesResult } from '@/lib/services/receivables-service';

interface ReceivablesClientProps {
  initialData?: ReceivablesResult;
  initialParams?: ReceivablesQueryParams;
}

/**
 * 应收账款客户端交互组件
 * 处理搜索、筛选、分页等客户端交互
 */
export function ReceivablesClient({
  initialData,
  initialParams,
}: ReceivablesClientProps) {
  const {
    queryParams,
    currentData,
    isLoading,
    isFetching,
    searchValue,
    isSearching,
    error,
    handleSearch,
    handleFilterChange,
    handleDateRangeChange,
    handlePageChange,
    handleClearFilters,
    handleOpenPaymentDialog,
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    selectedReceivable,
    retryQuery,
  } = useReceivablesController({ initialData, initialParams });

  return (
    <div className="space-y-6">
      <ReceivablesSummaryCards summary={currentData.summary} />

      <ReceivablesFilterCard
        queryParams={queryParams}
        isLoading={isLoading}
        isSearching={isSearching || isFetching}
        error={error}
        receivables={currentData.receivables || []}
        pagination={currentData.pagination}
        searchValue={searchValue}
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onDateRangeChange={handleDateRangeChange}
        onPageChange={handlePageChange}
        onClearFilters={handleClearFilters}
        onOpenPaymentDialog={handleOpenPaymentDialog}
        onRetry={retryQuery}
      />

      <ReceivablePaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        receivable={selectedReceivable}
      />
    </div>
  );
}
