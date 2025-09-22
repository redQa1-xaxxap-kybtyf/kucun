'use client';

import { useParams, useRouter } from 'next/navigation';

import { FactoryShipmentOrderForm } from '@/components/factory-shipments/factory-shipment-order-form';

/**
 * 编辑厂家发货订单页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 */
export default function EditFactoryShipmentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  // 处理更新成功
  const handleSuccess = (order: unknown) => {
    console.log('厂家发货订单更新成功:', order);
    router.push(`/factory-shipments/${orderId}`);
  };

  // 处理取消
  const handleCancel = () => {
    router.push(`/factory-shipments/${orderId}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">编辑厂家发货订单</h1>
        <p className="mt-1 text-sm text-gray-600">
          修改厂家发货订单信息，支持多供应商商品和临时商品管理
        </p>
      </div>
      
      <FactoryShipmentOrderForm 
        orderId={orderId}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
