'use client';

import { useRouter } from 'next/navigation';

import { FactoryShipmentOrderDetail } from '@/components/factory-shipments/factory-shipment-order-detail';

interface FactoryShipmentOrderDetailWrapperProps {
  orderId: string;
}

/**
 * 厂家发货订单详情客户端包装组件
 * 仅处理路由跳转等客户端交互
 */
export function FactoryShipmentOrderDetailWrapper({
  orderId,
}: FactoryShipmentOrderDetailWrapperProps) {
  const router = useRouter();
  // 处理编辑
  const handleEdit = () => {
    router.push(`/factory-shipments/${orderId}/edit`);
  };

  // 处理返回
  const handleBack = () => {
    router.push('/factory-shipments');
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <FactoryShipmentOrderDetail
        orderId={orderId}
        onEdit={handleEdit}
        onBack={handleBack}
      />
    </div>
  );
}
