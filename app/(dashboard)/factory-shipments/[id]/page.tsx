'use client';

import { useParams, useRouter } from 'next/navigation';

import { FactoryShipmentOrderDetail } from '@/components/factory-shipments/factory-shipment-order-detail';

/**
 * 厂家发货订单详情页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 */
export default function FactoryShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  // 处理编辑
  const handleEdit = () => {
    router.push(`/factory-shipments/${orderId}/edit`);
  };

  // 处理返回
  const handleBack = () => {
    router.push('/factory-shipments');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <FactoryShipmentOrderDetail
        orderId={orderId}
        onEdit={handleEdit}
        onBack={handleBack}
      />
    </div>
  );
}
