'use client';

import { useRouter } from 'next/navigation';

import { FactoryShipmentOrderList } from '@/components/factory-shipments/factory-shipment-order-list';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';

/**
 * 厂家发货订单页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 */
export default function FactoryShipmentsPage() {
  const router = useRouter();

  // 处理订单选择
  const handleOrderSelect = (order: FactoryShipmentOrder) => {
    router.push(`/factory-shipments/${order.id}`);
  };

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <FactoryShipmentOrderList onOrderSelect={handleOrderSelect} />
    </div>
  );
}
