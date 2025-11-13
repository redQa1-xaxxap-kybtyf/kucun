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
      // 期初库存录入二次确认
      if (data.reason === 'opening_balance') {
        const confirmed = window.confirm(
          '您正在录入期初库存数据，请确认数据准确无误。\n\n' +
            '期初库存将影响后续所有财务核算，建议录入完成后进行核对。\n\n' +
            '确定要继续吗？'
        );

        if (!confirmed) {
          throw new Error('已取消期初库存录入');
        }
      }

      const idempotencyKey = generateIdempotencyKey();

      if (!data.inputQuantity || data.inputQuantity <= 0) {
        throw new Error('请填写大于 0 的入库数量');
      }

      if (!data.quantity || data.quantity <= 0) {
        throw new Error('最终片数计算有误，请检查输入');
      }

      if (!data.unitCost || data.unitCost <= 0) {
        throw new Error('请填写大于 0 的单位成本');
      }

      const requestData: CreateInboundRequest = {
        idempotencyKey,
        productId: data.productId,
        inputQuantity: data.inputQuantity,
        inputUnit: data.inputUnit,
        quantity: data.quantity,
        unitCost: data.unitCost,
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
