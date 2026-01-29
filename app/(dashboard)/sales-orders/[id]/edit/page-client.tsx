'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import type { SalesOrder } from '@/lib/types/sales-order';

const ERPSalesOrderForm = dynamic(
  () =>
    import('@/components/sales-orders/erp-sales-order-form').then(
      mod => mod.ERPSalesOrderForm
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        表单加载中...
      </div>
    ),
  }
);

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
