'use client';

import { useRouter } from 'next/navigation';

import { EnhancedSalesOrderForm } from '@/components/sales-orders/enhanced-sales-order-form';

/**
 * 新建销售订单页面
 * 严格遵循全栈项目统一约定规范
 */
export default function CreateSalesOrderPage() {
  const router = useRouter();

  return (
    <EnhancedSalesOrderForm
      onSuccess={order => {
        // 创建成功后跳转到订单详情页或列表页
        router.push(`/sales-orders/${order.id}`);
      }}
      onCancel={() => {
        router.back();
      }}
    />
  );
}
