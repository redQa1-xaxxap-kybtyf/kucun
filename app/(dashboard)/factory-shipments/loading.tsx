import { FactoryShipmentOrderListSkeleton } from '@/components/factory-shipments/factory-shipment-order-list-skeleton';

/**
 * 厂家发货订单页面加载骨架屏
 * Next.js 15 会自动在页面加载时显示此组件
 */
export default function FactoryShipmentsLoading() {
  return <FactoryShipmentOrderListSkeleton />;
}
