'use client';

import { useRouter } from 'next/navigation';

import type { useCreateInboundRecord } from '@/lib/api/inbound';
import { useFormSubmit } from '@/lib/hooks/use-form-submit';
import {
  type CreateInboundRequest,
  type InboundFormData,
} from '@/lib/types/inbound';

interface UseInboundFormSubmitProps {
  createMutation: ReturnType<typeof useCreateInboundRecord>;
  onSuccess?: () => void;
}

export function useInboundFormSubmit({
  createMutation,
  onSuccess,
}: UseInboundFormSubmitProps) {
  const router = useRouter();

  const generateIdempotencyKey = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return useFormSubmit<InboundFormData>({
    onSubmit: async data => {
      const idempotencyKey = generateIdempotencyKey();

      if (!data.inputQuantity || data.inputQuantity <= 0) {
        throw new Error('请填写大于 0 的入库数量');
      }

      if (!data.quantity || data.quantity <= 0) {
        throw new Error('最终片数计算有误，请检查输入');
      }

      const requestData: CreateInboundRequest = {
        idempotencyKey,
        productId: data.productId,
        inputQuantity: data.inputQuantity,
        inputUnit: data.inputUnit,
        quantity: data.quantity,
        reason: data.reason,
      };

      if (data.variantId) {
        requestData.variantId = data.variantId;
      }

      if (data.remarks) {
        const trimmedRemarks = data.remarks.trim();
        if (trimmedRemarks.length > 0) {
          requestData.remarks = trimmedRemarks;
        }
      }

      if (data.batchNumber) {
        const trimmedBatchNumber = data.batchNumber.trim();
        if (trimmedBatchNumber.length > 0) {
          requestData.batchNumber = trimmedBatchNumber;
        }
      }

      // 可选字段：只在有效值时添加
      if (data.piecesPerUnit && data.piecesPerUnit > 0) {
        requestData.piecesPerUnit = data.piecesPerUnit;
      }

      if (data.weight && data.weight > 0) {
        requestData.weight = data.weight;
      }

      return await createMutation.mutateAsync(requestData);
    },
    onSuccess: () => {
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
