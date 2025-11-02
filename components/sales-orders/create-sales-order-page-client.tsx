'use client';

import { useRouter } from 'next/navigation';

import { ERPSalesOrderForm } from './erp-sales-order-form';

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
      initialOrderNumber={initialOrderNumber}
      onSuccess={() => {
        // 创建成功后返回订单列表
        router.push('/sales-orders');
      }}
      onCancel={() => {
        router.push('/sales-orders');
      }}
    />
  );
}

