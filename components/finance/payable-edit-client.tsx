'use client';

import { useRouter } from 'next/navigation';

import { PayableForm } from '@/components/finance/payable-form';
import type { PayableRecordDetail } from '@/lib/types/payable';

interface PayableEditClientProps {
  payableId: string;
  initialData: PayableRecordDetail;
}

/**
 * 应付款编辑客户端组件
 * 处理应付款编辑成功后的提示和跳转
 */
export function PayableEditClient({
  payableId,
  initialData,
}: PayableEditClientProps) {
  const router = useRouter();

  const handleSuccess = (payable: PayableRecordDetail) => {
    // 跳转到应付款详情页
    router.push(`/finance/payables/${payable.id}`);
  };

  return (
    <PayableForm
      mode="edit"
      payableId={payableId}
      initialData={initialData}
      onSuccess={handleSuccess}
    />
  );
}

