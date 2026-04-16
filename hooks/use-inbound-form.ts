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
  type InboundReason,
} from '@/lib/validations/inbound';

interface UseInboundFormOptions {
  initialReason?: InboundReason;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function useInboundForm(options?: UseInboundFormOptions) {
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );

  // 表单配置
  const form = useForm<InboundFormData, any, InboundFormData>({
    // standard-schema 的 TS 类型与我们基于 Zod 的 schema 定义存在差异，这里通过 any 适配。
    resolver: (standardSchemaResolver as any)(inboundFormSchema) as any,
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues: {
      productId: '',
      inputQuantity: undefined,
      damagedInputQuantity: undefined,
      inputUnit: 'pieces' as InboundUnit,
      quantity: undefined, // ✅ 修改：默认值改为 undefined
      damagedQuantity: undefined,
      damageHandling: undefined,
      damageRemarks: '',
      unitCost: undefined,
      reason: options?.initialReason || 'purchase',
      remarks: '',
      batchNumber: '',
      piecesPerUnit: undefined,
      weight: undefined,
    },
  });

  // API Hooks
  const createMutation = useCreateInboundRecord();

  // 监听表单变化
  const watchedInputQuantity =
    normalizeOptionalNumber(form.watch('inputQuantity')) ?? 0;
  const watchedInputUnit = form.watch('inputUnit');
  const watchedPiecesPerUnit =
    normalizeOptionalNumber(form.watch('piecesPerUnit')) ?? 0;
  const watchedDamagedInputQuantity =
    normalizeOptionalNumber(form.watch('damagedInputQuantity')) ?? 0;

  return {
    form,
    selectedProduct,
    setSelectedProduct,
    createMutation,
    watchedInputQuantity,
    watchedInputUnit,
    watchedPiecesPerUnit,
    watchedDamagedInputQuantity,
  };
}

// 将录入数量按当前单位换算为片数
export function calculateFinalQuantity(
  inputQuantity: number | undefined,
  inputUnit: InboundUnit,
  piecesPerUnit: number | undefined
): number | undefined {
  try {
    // ✅ 修复：如果没有输入数量，返回 undefined
    if (!inputQuantity || inputQuantity <= 0) {
      return undefined;
    }

    // ✅ 修复：如果入库单位是"片"，直接返回输入数量，不需要换算
    if (inputUnit === 'pieces') {
      return inputQuantity;
    }

    // ✅ 如果入库单位是"件"，必须有件片比才能换算
    if (inputUnit === 'units') {
      if (
        !Number.isInteger(piecesPerUnit) ||
        !piecesPerUnit ||
        piecesPerUnit <= 0
      ) {
        return undefined; // 缺少件片比，无法换算
      }

      return calculateTotalPieces(
        { value: inputQuantity, unit: inputUnit },
        piecesPerUnit
      );
    }

    // 其他单位，直接返回输入数量
    return inputQuantity;
  } catch {
    return undefined;
  }
}

export function calculateAcceptedInboundQuantity(options: {
  reason: InboundReason;
  inputQuantity: number | undefined;
  damagedInputQuantity: number | undefined;
  inputUnit: InboundUnit;
  piecesPerUnit: number | undefined;
}): {
  quantity: number | undefined;
  damagedQuantity: number | undefined;
} {
  const inputQuantityInPieces = calculateFinalQuantity(
    options.inputQuantity,
    options.inputUnit,
    options.piecesPerUnit
  );
  const damagedQuantityInPieces =
    options.damagedInputQuantity && options.damagedInputQuantity > 0
      ? calculateFinalQuantity(
          options.damagedInputQuantity,
          options.inputUnit,
          options.piecesPerUnit
        )
      : undefined;

  if (options.reason !== 'purchase') {
    return {
      quantity: inputQuantityInPieces,
      damagedQuantity: damagedQuantityInPieces,
    };
  }

  if (inputQuantityInPieces === undefined) {
    return {
      quantity: undefined,
      damagedQuantity: damagedQuantityInPieces,
    };
  }

  const acceptedQuantity =
    inputQuantityInPieces - (damagedQuantityInPieces ?? 0);

  return {
    quantity: acceptedQuantity > 0 ? acceptedQuantity : 0,
    damagedQuantity: damagedQuantityInPieces,
  };
}

// 处理产品选择的逻辑
// ✅ 修复: 使用泛型参数以兼容 standardSchemaResolver
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
    form.setValue('quantity', undefined, {
      shouldDirty: false,
      shouldValidate: false,
    }); // ✅ 修改：设置为 undefined
    form.setValue('damagedInputQuantity', undefined, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue('damagedQuantity', undefined, {
      shouldDirty: false,
      shouldValidate: false,
    });
    form.setValue('damageHandling', undefined, {
      shouldDirty: false,
      shouldValidate: false,
    });
    form.setValue('damageRemarks', '', {
      shouldDirty: false,
      shouldValidate: false,
    });
    form.setValue('piecesPerUnit', undefined, {
      shouldDirty: false,
      shouldValidate: false,
    });
    form.setValue('batchNumber', '', {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue('weight', undefined, {
      shouldDirty: false,
      shouldValidate: false,
    });

    form.clearErrors([
      'productId',
      'inputQuantity',
      'quantity',
      'damagedInputQuantity',
      'damagedQuantity',
      'damageHandling',
      'piecesPerUnit',
      'weight',
    ]);
  };

  const handleReset = () => {
    // 保持当前入库类型，避免采购/期初场景在重置后跳回默认流程
    const currentReason = form.getValues('reason');

    form.reset({
      productId: '',
      inputQuantity: undefined,
      damagedInputQuantity: undefined,
      inputUnit: 'pieces' as InboundUnit,
      quantity: undefined,
      damagedQuantity: undefined,
      damageHandling: undefined,
      damageRemarks: '',
      unitCost: undefined,
      reason: currentReason,
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
