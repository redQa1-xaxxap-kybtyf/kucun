'use client';

import { useRouter } from 'next/navigation';

import { ERPSalesOrderList } from '@/components/sales-orders/erp-sales-order-list';
import type { SalesOrder } from '@/lib/types/sales-order';

/**
 * 销售订单页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 */
export default function SalesOrdersPage() {
  const router = useRouter();

  // 处理订单选择
  const handleOrderSelect = (order: SalesOrder) => {
    router.push(`/sales-orders/${order.id}`);
  };

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <ERPSalesOrderList onOrderSelect={handleOrderSelect} />
    </div>
  );
}
