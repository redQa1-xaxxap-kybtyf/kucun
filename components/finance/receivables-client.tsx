'use client';

import { PaymentCreationDialog } from '@/components/finance/payment-creation-dialog';
import { ReceivablesFilterCard } from '@/components/finance/receivables-client/ReceivablesFilterCard';
import { ReceivablesSummaryCards } from '@/components/finance/receivables-client/ReceivablesSummaryCards';
import type { ReceivablesQueryParams } from '@/components/finance/receivables-client/types';
import { useReceivablesController } from '@/components/finance/receivables-client/useReceivablesController';
import type { ReceivablesResult } from '@/lib/services/receivables-service';

interface ReceivablesClientProps {
  initialData: ReceivablesResult;
  initialParams?: ReceivablesQueryParams;
}

/**
 * 应收账款客户端交互组件
 * 处理搜索、筛选、分页等客户端交互
 */
export function ReceivablesClient({ initialData, initialParams }: ReceivablesClientProps) {
  const {
    queryParams,
    currentData,
    isLoading,
    error,
    handleSearch,
    handleFilterChange,
    handleDateRangeChange,
    handlePageChange,
    handleOpenPaymentDialog,
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    selectedOrder,
  } = useReceivablesController({ initialData, initialParams });

  return (
    <div className="space-y-6">
      <ReceivablesSummaryCards summary={currentData.summary} />

      <ReceivablesFilterCard
        queryParams={queryParams}
        isLoading={isLoading}
        error={error}
        receivables={currentData.receivables || []}
        pagination={currentData.pagination}
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onDateRangeChange={handleDateRangeChange}
        onPageChange={handlePageChange}
        onOpenPaymentDialog={handleOpenPaymentDialog}
      />

      <PaymentCreationDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        orderInfo={selectedOrder}
      />
    </div>
  );
}
