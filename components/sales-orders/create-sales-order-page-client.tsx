'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

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
}

/**
 * 销售订单创建页面的客户端组件
 * 接收服务端预生成的订单号，消除加载延迟
 */
export function CreateSalesOrderPageClient({
  initialOrderNumber,
}: CreateSalesOrderPageClientProps) {
  const router = useRouter();

  return (
    <ERPSalesOrderForm
      key={initialOrderNumber} // 强制以订单号作为key，确保每次新建都完全重置表单状态
      initialOrderNumber={initialOrderNumber}
      onSuccess={order => {
        router.push(`/sales-orders/${order.id}`);
      }}
      onCancel={() => {
        router.push('/sales-orders');
      }}
    />
  );
}
