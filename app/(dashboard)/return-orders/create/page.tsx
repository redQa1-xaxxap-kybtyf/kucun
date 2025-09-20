'use client';

import { useRouter } from 'next/navigation';

import { ERPReturnOrderForm } from '@/components/return-orders/erp-return-order-form';

/**
 * 新建退货订单页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export default function CreateReturnOrderPage() {
  const router = useRouter();

  // 处理创建成功
  const handleSuccess = () => {
    router.push('/return-orders');
  };

  // 处理取消
  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPReturnOrderForm
        mode="create"
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
