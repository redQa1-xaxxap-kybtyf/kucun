'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useCreateInboundRecord } from '@/lib/api/inbound';
import { type InboundUnit, type ProductOption } from '@/lib/types/inbound';
import { calculateTotalPieces } from '@/lib/utils/piece-calculation';
import {
  inboundFormSchema,
  type InboundFormData,
} from '@/lib/validations/inbound';

export function useInboundForm() {
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );

  // 表单配置
  const form = useForm<InboundFormData>({
    resolver: standardSchemaResolver(inboundFormSchema),
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues: {
      productId: '',
      inputQuantity: undefined,
      inputUnit: 'pieces' as InboundUnit,
      quantity: undefined, // ✅ 修改：默认值改为 undefined
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
): number | undefined {
  // ✅ 修改：返回类型改为 number | undefined
  try {
    if (
      !inputQuantity ||
      inputQuantity <= 0 ||
      !piecesPerUnit ||
      piecesPerUnit <= 0
    ) {
      return undefined; // ✅ 修改：返回 undefined 而不是 0
    }
    // 确保 piecesPerUnit 是有效的正整数
    const validPiecesPerUnit =
      Number.isInteger(piecesPerUnit) && piecesPerUnit > 0 ? piecesPerUnit : 1;

    return calculateTotalPieces(
      { value: inputQuantity, unit: inputUnit },
      validPiecesPerUnit
    );
  } catch {
    return inputQuantity; // ✅ 修改：发生错误时返回输入数量（可能是 undefined）
  }
}

// 处理产品选择的逻辑
// ✅ 修复: 使用泛型参数以兼容 standardSchemaResolver
export function useProductSelection(
  form: ReturnType<typeof useForm<InboundFormData, any, any>>,
  setSelectedProduct: (product: ProductOption | null) => void
) {
  const handleProductSelect = (product: ProductOption) => {
    setSelectedProduct(product);
    form.setValue('inputQuantity', undefined, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue('quantity', undefined, {
      shouldDirty: false,
      shouldValidate: false,
    }); // ✅ 修改：设置为 undefined
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
      quantity: undefined, // ✅ 修改：设置为 undefined
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
