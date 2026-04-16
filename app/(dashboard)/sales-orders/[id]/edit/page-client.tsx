'use client';

import dynamic from 'next/dynamic';

import type { SalesOrder } from '@/lib/types/sales-order';
import { withReturnTo } from '@/lib/utils/sales-order-navigation';

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
  returnTo?: string;
}

export function EditSalesOrderPageClient({
  orderId,
  initialData,
  returnTo,
}: Props) {
  return (
    <ERPSalesOrderForm
      mode="edit"
      orderId={orderId}
      initialData={initialData}
      successHref={order => withReturnTo(`/sales-orders/${order.id}`, returnTo)}
      cancelHref={withReturnTo(`/sales-orders/${orderId}`, returnTo)}
    />
  );
}
