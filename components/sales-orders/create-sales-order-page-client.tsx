'use client';

import dynamic from 'next/dynamic';

import type { Customer } from '@/lib/types/customer';
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

interface CreateSalesOrderPageClientProps {
  initialOrderNumber: string;
  duplicateSourceOrder?: SalesOrder;
  prefillCustomer?: Pick<Customer, 'id' | 'name' | 'phone' | 'address'>;
  cancelHref?: string;
  returnTo?: string;
}

/**
 * 销售订单创建页面的客户端组件
 * 接收服务端预生成的订单号，消除加载延迟
 */
export function CreateSalesOrderPageClient({
  initialOrderNumber,
  duplicateSourceOrder,
  prefillCustomer,
  cancelHref = '/sales-orders',
  returnTo,
}: CreateSalesOrderPageClientProps) {
  return (
    <ERPSalesOrderForm
      key={`${initialOrderNumber}:${duplicateSourceOrder?.id ?? 'new'}:${prefillCustomer?.id ?? 'no-customer'}`}
      initialOrderNumber={initialOrderNumber}
      duplicateSourceOrder={duplicateSourceOrder}
      prefillCustomer={prefillCustomer}
      successHref={order => withReturnTo(`/sales-orders/${order.id}`, returnTo)}
      cancelHref={cancelHref}
    />
  );
}
