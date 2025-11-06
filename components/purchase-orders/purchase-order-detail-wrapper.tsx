'use client';

import { useRouter } from 'next/navigation';

import { PurchaseOrderDetail } from '@/components/purchase-orders/purchase-order-detail';

interface PurchaseOrderDetailWrapperProps {
  orderId: string;
}

export function PurchaseOrderDetailWrapper({
  orderId,
}: PurchaseOrderDetailWrapperProps) {
  const router = useRouter();

  const handleBack = () => {
    router.push('/purchase-orders');
  };

  const handleEdit = () => {
    router.push(`/purchase-orders/${orderId}/edit`);
  };

  return (
    <PurchaseOrderDetail
      orderId={orderId}
      onBack={handleBack}
      onEdit={handleEdit}
    />
  );
}
