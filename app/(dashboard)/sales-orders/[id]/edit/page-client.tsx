'use client';

import { useRouter } from 'next/navigation';

import { ERPSalesOrderForm } from '@/components/sales-orders/erp-sales-order-form';
import type { SalesOrder } from '@/lib/types/sales-order';

interface Props {
  orderId: string;
  initialData: SalesOrder;
}

export function EditSalesOrderPageClient({ orderId, initialData }: Props) {
  const router = useRouter();

  return (
    <ERPSalesOrderForm
      mode="edit"
      orderId={orderId}
      initialData={initialData}
      onSuccess={() => {
        router.push('/sales-orders');
      }}
      onCancel={() => {
        router.push(`/sales-orders/${orderId}`);
      }}
    />
  );
}
