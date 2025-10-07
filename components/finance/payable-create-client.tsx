'use client';

import { useRouter } from 'next/navigation';

import { PayableForm } from '@/components/finance/payable-form';
import type { PayableRecordDetail } from '@/lib/types/payable';

/**
 * 应付款创建客户端组件
 * 处理应付款创建成功后的提示和跳转
 */
export function PayableCreateClient() {
  const router = useRouter();

  const handleSuccess = (payable: PayableRecordDetail) => {
    // 跳转到应付款详情页
    router.push(`/finance/payables/${payable.id}`);
  };

  return <PayableForm mode="create" onSuccess={handleSuccess} />;
}
