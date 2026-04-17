'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { PayableTableList } from '@/components/finance/payables-client/PayableTableList';
import { TableSkeleton } from '@/components/ui/skeleton-compositions';
import type { PayableRecordDetail } from '@/lib/types/payable';

const PayablePaymentDialog = dynamic(
  () =>
    import('@/components/finance/payables-client/PayablePaymentDialog').then(
      mod => mod.PayablePaymentDialog
    ),
  { ssr: false, loading: () => null }
);

interface Props {
  items: PayableRecordDetail[];
  isLoading: boolean;
  onView: (id: string) => void;
  onPayNow: (id: string) => void;
}

export function PayableList({ items, isLoading, onView, onPayNow }: Props) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] =
    useState<PayableRecordDetail | null>(null);

  const handlePayNow = (payableId: string) => {
    const payable = items.find(item => item.id === payableId);
    if (!payable) {
      onPayNow(payableId);
      return;
    }

    setSelectedPayable(payable);
    setPaymentDialogOpen(true);
  };

  const handlePaymentDialogClose = () => {
    setPaymentDialogOpen(false);
    setSelectedPayable(null);
  };

  if (isLoading) {
    return <TableSkeleton columns={11} rows={8} showPagination />;
  }

  return (
    <div className="space-y-4">
      <PayableTableList
        items={items}
        isLoading={isLoading}
        onView={onView}
        onPayNow={handlePayNow}
      />

      {/* 付款模态框 */}
      {paymentDialogOpen && selectedPayable && (
        <PayablePaymentDialog
          open={paymentDialogOpen}
          onOpenChange={handlePaymentDialogClose}
          payableInfo={selectedPayable}
        />
      )}
    </div>
  );
}
