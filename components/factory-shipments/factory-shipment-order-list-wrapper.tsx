'use client';

import { useRouter } from 'next/navigation';

import { FactoryShipmentOrderList } from '@/components/factory-shipments/factory-shipment-order-list';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';

/**
 * 厂家发货订单列表客户端包装组件
 * 仅处理路由跳转等客户端交互
 */
export function FactoryShipmentOrderListWrapper() {
  const router = useRouter();

  // 处理订单选择
  const handleOrderSelect = (order: FactoryShipmentOrder) => {
    router.push(`/factory-shipments/${order.id}`);
  };

  return <FactoryShipmentOrderList onOrderSelect={handleOrderSelect} />;
}
