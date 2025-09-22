'use client';

import { useRouter } from 'next/navigation';

import { FactoryShipmentOrderForm } from '@/components/factory-shipments/factory-shipment-order-form';

/**
 * 创建厂家发货订单页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 */
export default function CreateFactoryShipmentPage() {
  const router = useRouter();

  // 处理创建成功
  const handleSuccess = () => {
    // 厂家发货订单创建成功，跳转到列表页
    router.push('/factory-shipments');
  };

  // 处理取消
  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">创建厂家发货订单</h1>
        <p className="mt-1 text-sm text-gray-600">
          创建新的厂家发货订单，支持多供应商商品和临时商品管理
        </p>
      </div>

      <FactoryShipmentOrderForm
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
