'use client';

import { useRouter } from 'next/navigation';

import type { useCreateInboundRecord } from '@/lib/api/inbound';
import { useFormSubmit } from '@/lib/hooks/use-form-submit';
import { type InboundFormData } from '@/lib/types/inbound';

interface UseInboundFormSubmitProps {
  createMutation: ReturnType<typeof useCreateInboundRecord>;
  onSuccess?: () => void;
}

export function useInboundFormSubmit({
  createMutation,
  onSuccess,
}: UseInboundFormSubmitProps) {
  const router = useRouter();

  return useFormSubmit<InboundFormData>({
    onSubmit: async data => {
      // 构造请求数据，确保必填字段有默认值
      const requestData = {
        productId: data.productId,
        inputQuantity: data.inputQuantity,
        inputUnit: data.inputUnit,
        quantity: data.quantity,
        reason: data.reason,
        remarks: data.remarks || '',
        batchNumber: data.batchNumber || '',
        piecesPerUnit: data.piecesPerUnit,
        weight: data.weight,
      };

      return await createMutation.mutateAsync(requestData);
    },
    onSuccess: result => {
      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      } else {
        // 默认跳转到入库记录页面
        router.push('/inventory/inbound');
      }
    },
    successMessage: '入库成功',
    errorMessage: '入库失败',
  });
}
