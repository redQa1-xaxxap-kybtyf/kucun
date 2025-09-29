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

export function useInboundForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );

  // 表单配置
  const form = useForm<InboundFormData>({
    resolver: zodResolver(createInboundSchema),
    defaultValues: {
      productId: '',
      inputQuantity: 1,
      inputUnit: 'pieces' as InboundUnit,
      quantity: 1,
      reason: 'purchase',
      remarks: '',
      batchNumber: '',
      piecesPerUnit: 1,
      weight: 0.01,
    },
  });

  // API Hooks
  const createMutation = useCreateInboundRecord();

  // 监听表单变化
  const watchedInputQuantity = form.watch('inputQuantity');
  const watchedInputUnit = form.watch('inputUnit');
  const watchedPiecesPerUnit = form.watch('piecesPerUnit');

  return {
    form,
    isSubmitting,
    setIsSubmitting,
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
  inputQuantity: number,
  inputUnit: InboundUnit,
  piecesPerUnit: number
): number {
  try {
    // 确保 piecesPerUnit 是有效的正整数
    const validPiecesPerUnit =
      Number.isInteger(piecesPerUnit) && piecesPerUnit > 0 ? piecesPerUnit : 1;

    return calculateTotalPieces(
      { value: inputQuantity, unit: inputUnit },
      validPiecesPerUnit
    );
  } catch (error) {
    return inputQuantity; // 发生错误时返回输入数量
  }
}

// 处理产品选择的逻辑
export function useProductSelection(
  form: ReturnType<typeof useForm<InboundFormData>>,
  setSelectedProduct: (product: ProductOption | null) => void
) {
  const handleProductSelect = (product: ProductOption) => {
    setSelectedProduct(product);
    form.setValue('inputQuantity', 1);
    form.setValue('quantity', 1);
    form.setValue('piecesPerUnit', product.piecesPerUnit || 1);
    form.setValue('weight', 0.01);

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
      inputQuantity: 1,
      inputUnit: 'pieces' as InboundUnit,
      quantity: 1,
      reason: 'purchase',
      remarks: '',
      batchNumber: '',
      piecesPerUnit: 1,
      weight: 0.01,
    });
    setSelectedProduct(null);
  };

  return {
    handleProductSelect,
    handleReset,
  };
}
