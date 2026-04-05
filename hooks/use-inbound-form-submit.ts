'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import type { useCreateInboundRecord } from '@/lib/api/inbound';
import { useFormSubmit } from '@/lib/hooks/use-form-submit';
import {
  type CreateInboundRequest,
  type InboundFormData,
} from '@/lib/types/inbound';

interface UseInboundFormSubmitProps {
  createMutation: ReturnType<typeof useCreateInboundRecord>;
  onSuccess?: () => void;
  /**
   * 是否跳过期初入库确认
   * 当为 true 时，即使是期初入库也不会触发确认检查
   * 用于在用户已经通过确认对话框确认后的实际提交
   */
  skipConfirm?: boolean;
}

export function useInboundFormSubmit({
  createMutation,
  onSuccess,
  skipConfirm: _skipConfirm = false,
}: UseInboundFormSubmitProps) {
  const router = useRouter();
  const lastSubmittedReasonRef = useRef<InboundFormData['reason']>();
  const buildInventoryRedirectUrl = () =>
    `/inventory?hasStock=true&refresh=${Date.now()}`;

  const generateIdempotencyKey = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return useFormSubmit<InboundFormData>({
    onSubmit: async data => {
      lastSubmittedReasonRef.current = data.reason;

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

      // 普通入库场景下，若选择了供应商则一并提交；
      // 期初入库(opening_balance)时供应商为可选。
      if (data.supplierId && data.supplierId.trim().length > 0) {
        requestData.supplierId = data.supplierId.trim();
      }

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

      if (
        data.damagedInputQuantity &&
        data.damagedInputQuantity > 0 &&
        data.damagedQuantity &&
        data.damagedQuantity > 0
      ) {
        requestData.damagedInputQuantity = data.damagedInputQuantity;
        requestData.damagedQuantity = data.damagedQuantity;

        if (data.damageHandling) {
          requestData.damageHandling = data.damageHandling;
        }

        if (data.damageRemarks) {
          const trimmedDamageRemarks = data.damageRemarks.trim();
          if (trimmedDamageRemarks.length > 0) {
            requestData.damageRemarks = trimmedDamageRemarks;
          }
        }
      }

      return await createMutation.mutateAsync(requestData);
    },
    onSuccess: () => {
      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      } else {
        if (lastSubmittedReasonRef.current === 'opening_balance') {
          router.push(buildInventoryRedirectUrl());
          return;
        }

        // 默认跳转到入库记录页面
        router.push('/inventory/inbound');
      }
    },
    successMessage: '入库成功',
    errorMessage: '入库失败',
  });
}
