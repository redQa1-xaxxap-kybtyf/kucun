'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useCreateInboundRecord } from '@/lib/api/inbound';
import {
  type InboundFormData,
  type InboundUnit,
  type ProductOption,
} from '@/lib/types/inbound';
import { calculateTotalPieces } from '@/lib/utils/piece-calculation';
import { createInboundSchema } from '@/lib/validations/inbound';

const inboundFormSchema = createInboundSchema.omit({ idempotencyKey: true });

export function useInboundForm() {
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );

  // 表单配置
  const form = useForm<InboundFormData>({
    resolver: zodResolver(inboundFormSchema),
    defaultValues: {
      productId: '',
      inputQuantity: undefined,
      inputUnit: 'pieces' as InboundUnit,
      quantity: 0,
      unitCost: undefined,
      reason: 'purchase',
      remarks: '',
      batchNumber: '',
      piecesPerUnit: undefined,
      weight: undefined,
    },
  });

  // API Hooks
  const createMutation = useCreateInboundRecord();

  // 监听表单变化
  const watchedInputQuantity = form.watch('inputQuantity') ?? 0;
  const watchedInputUnit = form.watch('inputUnit');
  const watchedPiecesPerUnit = form.watch('piecesPerUnit') ?? 0;

  return {
    form,
    selectedProduct,
    setSelectedProduct,
    createMutation,
    watchedInputQuantity,
    watchedInputUnit,
    watchedPiecesPerUnit,
  };
}

// 计算最终片数的工具函数
export function calculateFinalQuantity(
  inputQuantity: number | undefined,
  inputUnit: InboundUnit,
  piecesPerUnit: number | undefined
): number {
  try {
    if (
      !inputQuantity ||
      inputQuantity <= 0 ||
      !piecesPerUnit ||
      piecesPerUnit <= 0
    ) {
      return 0;
    }
    // 确保 piecesPerUnit 是有效的正整数
    const validPiecesPerUnit =
      Number.isInteger(piecesPerUnit) && piecesPerUnit > 0 ? piecesPerUnit : 1;

    return calculateTotalPieces(
      { value: inputQuantity, unit: inputUnit },
      validPiecesPerUnit
    );
  } catch {
    return inputQuantity ?? 0; // 发生错误时返回输入数量
  }
}

// 处理产品选择的逻辑
export function useProductSelection(
  form: ReturnType<typeof useForm<InboundFormData>>,
  setSelectedProduct: (product: ProductOption | null) => void
) {
  const handleProductSelect = (product: ProductOption) => {
    setSelectedProduct(product);
    form.setValue('inputQuantity', undefined, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue('quantity', 0, { shouldDirty: false, shouldValidate: false });
    const hasPiecesPerUnit =
      product.piecesPerUnit !== undefined && product.piecesPerUnit !== null;
    form.setValue(
      'piecesPerUnit',
      hasPiecesPerUnit ? product.piecesPerUnit : undefined,
      hasPiecesPerUnit
        ? { shouldDirty: true, shouldValidate: false }
        : { shouldDirty: false, shouldValidate: false }
    );
    form.setValue('batchNumber', '', {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    const productWithWeight = product as ProductOption & {
      weight?: number | null;
    };
    const hasWeight =
      productWithWeight.weight !== undefined &&
      productWithWeight.weight !== null;
    form.setValue(
      'weight',
      hasWeight ? (productWithWeight.weight ?? undefined) : undefined,
      hasWeight
        ? { shouldDirty: true, shouldValidate: false }
        : { shouldDirty: false, shouldValidate: false }
    );

    form.clearErrors([
      'productId',
      'inputQuantity',
      'quantity',
      'piecesPerUnit',
      'weight',
    ]);
  };

  const handleReset = () => {
    form.reset({
      productId: '',
      inputQuantity: undefined,
      inputUnit: 'pieces' as InboundUnit,
      quantity: 0,
      unitCost: undefined,
      reason: 'purchase',
      remarks: '',
      batchNumber: '',
      piecesPerUnit: undefined,
      weight: undefined,
    });
    setSelectedProduct(null);
  };

  return {
    handleProductSelect,
    handleReset,
  };
}
