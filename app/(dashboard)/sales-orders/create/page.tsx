'use client';

import { useRouter } from 'next/navigation';

import { ERPSalesOrderForm } from '@/components/sales-orders/erp-sales-order-form';

/**
 * 新建销售订单页面
 * 采用中国ERP系统标准布局
 */
export default function CreateSalesOrderPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <ERPSalesOrderForm
        onSuccess={(order: any) => {
          // 创建成功后跳转到订单详情页或列表页
          router.push(`/sales-orders/${order.id}`);
        }}
        onCancel={() => {
          router.back();
        }}
      />
    </div>
  );
}
