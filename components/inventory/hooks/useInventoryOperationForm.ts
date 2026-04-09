'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  useForm,
  useWatch,
  type DefaultValues,
  type UseFormReturn,
} from 'react-hook-form';
import type { ZodType } from 'zod';

import {
  adjustInventory,
  checkInventoryAvailability,
  createInbound,
  createOutbound,
} from '@/lib/api/inventory';
import { queryKeys } from '@/lib/queryKeys';
import { INBOUND_REASON_OPTIONS } from '@/lib/types/inbound';
import type {
  Inventory,
  InventoryAdjustInput,
  OutboundCreateInput,
} from '@/lib/types/inventory';
import { logger } from '@/lib/utils/console-logger';
import {
  createInboundSchema,
  type CreateInboundData,
} from '@/lib/validations/inbound';
import {
  ADJUST_REASON_LABELS,
  inventoryAdjustSchema,
  outboundCreateSchema,
  type InventoryAdjustFormData,
  type OutboundCreateFormData,
} from '@/lib/validations/inventory-operations';

export type OperationMode = 'inbound' | 'outbound' | 'adjust';

type FormValuesByMode = {
  inbound: CreateInboundData;
  outbound: OutboundCreateFormData;
  adjust: InventoryAdjustFormData;
};

type OperationResultByMode = {
  inbound: Inventory;
  outbound: Inventory;
  adjust: Inventory;
};

type AvailabilityResult = Awaited<
  ReturnType<typeof checkInventoryAvailability>
>;

type CreateMutationResult = UseMutationResult<
  Inventory,
  Error,
  CreateInboundData
>;

type UpdateMutationVariables = OutboundCreateInput | InventoryAdjustInput;

type UpdateMutationResult = UseMutationResult<
  Inventory,
  Error,
  UpdateMutationVariables
>;

interface FormConfig<M extends OperationMode> {
  schema: ZodType<FormValuesByMode[M]>;
  getDefaultValues: () => DefaultValues<FormValuesByMode[M]>;
  title: string;
  description: string;
  typeOptions?: Array<{ value: string; label: string }>;
}

const generateIdempotencyKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const OUTBOUND_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'normal_outbound', label: '正常出库' },
  { value: 'sales_outbound', label: '销售出库' },
  { value: 'sample_outbound', label: '样品出库' },
  { value: 'adjust_outbound', label: '调整出库' },
];

const FORM_CONFIG: {
  [K in OperationMode]: FormConfig<K>;
} = {
  inbound: {
    schema: createInboundSchema,
    getDefaultValues: () =>
      ({
        idempotencyKey: generateIdempotencyKey(),
        productId: '',
        variantId: undefined,
        inputQuantity: 1,
        inputUnit: 'pieces',
        quantity: 1,
        reason: 'purchase',
        remarks: '',
        batchNumber: '',
        piecesPerUnit: 1,
        weight: 0.01,
      }) satisfies DefaultValues<CreateInboundData>,
    title: '产品入库',
    description: '录入新的入库记录',
    typeOptions: INBOUND_REASON_OPTIONS.map(option => ({
      value: option.value,
      label: option.label,
    })),
  },
  outbound: {
    schema: outboundCreateSchema,
    getDefaultValues: () =>
      ({
        idempotencyKey: generateIdempotencyKey(),
        type: 'normal_outbound',
        productId: '',
        batchNumber: '',
        quantity: 1,
        unitCost: undefined,
        customerId: '',
        salesOrderId: '',
        remarks: '',
        variantId: '',
        reason: undefined,
        notes: '',
      }) satisfies DefaultValues<OutboundCreateFormData>,
    title: '产品出库',
    description: '登记本次出库数量',
    typeOptions: OUTBOUND_TYPE_OPTIONS,
  },
  adjust: {
    schema: inventoryAdjustSchema,
    getDefaultValues: () =>
      ({
        idempotencyKey: generateIdempotencyKey(),
        productId: '',
        batchNumber: '',
        adjustQuantity: 1,
        reason: 'other',
        notes: '',
        variantId: '',
        currentQuantity: undefined,
        maxQuantity: undefined,
        minQuantity: undefined,
      }) satisfies DefaultValues<InventoryAdjustFormData>,
    title: '库存调整',
    description: '调整库存数量',
  },
};

export interface UseInventoryOperationFormProps<
  M extends OperationMode = OperationMode,
> {
  mode: M;
  onSuccess?: (result: OperationResultByMode[M]) => void;
}

interface UseInventoryOperationFormReturn<
  M extends OperationMode = OperationMode,
> {
  form: UseFormReturn<FormValuesByMode[M], unknown, FormValuesByMode[M]>;
  formConfig: Pick<FormConfig<M>, 'title' | 'description'>;
  availabilityData: AvailabilityResult | undefined;
  submitError: string;
  isLoading: boolean;
  onSubmit: (values: FormValuesByMode[M]) => Promise<void>;
  getTypeOptions: () => Array<{ value: string; label: string }>;
}

export function useInventoryOperationForm<
  M extends OperationMode = OperationMode,
>({
  mode,
  onSuccess,
}: UseInventoryOperationFormProps<M>): UseInventoryOperationFormReturn<M> {
  const config = useMemo(() => FORM_CONFIG[mode], [mode]);
  const buildDefaultValues = useCallback(
    () => config.getDefaultValues(),
    [config]
  );
  const defaultValues = useMemo(
    () => buildDefaultValues(),
    [buildDefaultValues]
  );

  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string>('');

  const form = useForm<FormValuesByMode[M], unknown, FormValuesByMode[M]>({
    // 这里使用标准 schema resolver 统一处理验证，但内部 schema 使用 Zod，
    // 因此通过 any 适配类型差异，保持运行时行为不变。
    resolver: (standardSchemaResolver as any)(config.schema) as any,
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues,
  });

  const watchedProductId = useWatch({
    control: form.control,
    name: 'productId' as any,
  });
  const productId =
    typeof watchedProductId === 'string' && watchedProductId.trim().length > 0
      ? watchedProductId.trim()
      : undefined;

  const watchedQuantity = useWatch({
    control: form.control,
    name: 'quantity' as any,
  });
  const outboundQuantity =
    mode === 'outbound' && typeof watchedQuantity === 'number'
      ? watchedQuantity
      : undefined;

  const availabilityQuery = useAvailabilityData({
    productId,
    quantity: outboundQuantity,
    enabled: mode === 'outbound',
  });

  const createMutation = useCreateMutation({
    queryClient,
    onSuccess,
    setSubmitError,
    resetForm: () => form.reset(buildDefaultValues()),
  });

  const updateMutation = useUpdateMutation({
    queryClient,
    onSuccess,
    setSubmitError,
    mode,
    resetForm: () => form.reset(buildDefaultValues()),
  });

  const loadingState = combineLoadingState({
    createMutation,
    updateMutation,
    availabilityQuery,
  });

  const handleSubmit = useCallback(
    async (values: FormValuesByMode[M]) => {
      setSubmitError('');
      try {
        if (mode === 'inbound') {
          await createMutation.mutateAsync(
            normalizeInboundValues(values as CreateInboundData)
          );
          return;
        }

        if (mode === 'outbound') {
          await updateMutation.mutateAsync(
            normalizeOutboundValues(values as OutboundCreateFormData)
          );
          return;
        }

        await updateMutation.mutateAsync(
          normalizeAdjustValues(values as InventoryAdjustFormData)
        );
      } catch (error) {
        logger.error('[useInventoryOperationForm] 提交失败', { error });
        if (error instanceof Error && !error.message.includes('失败')) {
          setSubmitError(error.message);
        }
      }
    },
    [createMutation, mode, updateMutation]
  );

  const getTypeOptions = useCallback(() => {
    if (mode === 'inbound') {
      return config.typeOptions ?? [];
    }
    if (mode === 'outbound') {
      return config.typeOptions ?? OUTBOUND_TYPE_OPTIONS;
    }
    return Object.entries(ADJUST_REASON_LABELS).map(([value, label]) => ({
      value,
      label,
    }));
  }, [config.typeOptions, mode]);

  return {
    form,
    formConfig: {
      title: config.title,
      description: config.description,
    },
    availabilityData: availabilityQuery.data,
    submitError,
    isLoading: loadingState.isLoading,
    onSubmit: handleSubmit,
    getTypeOptions,
  };
}

function useAvailabilityData({
  productId,
  quantity,
  enabled,
}: {
  productId?: string;
  quantity?: number;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: [
      'inventory',
      'availability-check',
      productId ?? null,
      quantity ?? null,
    ] as const,
    queryFn: () =>
      checkInventoryAvailability(
        productId ?? '',
        typeof quantity === 'number' ? quantity : 0
      ),
    enabled:
      enabled &&
      Boolean(productId) &&
      typeof quantity === 'number' &&
      quantity > 0,
    staleTime: 5 * 60 * 1000,
  });
}

function useCreateMutation({
  queryClient,
  onSuccess,
  setSubmitError,
  resetForm,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  onSuccess?: (result: Inventory) => void;
  setSubmitError: (value: string) => void;
  resetForm: () => void;
}): CreateMutationResult {
  return useMutation({
    mutationFn: createInbound,
    onSuccess: async inventory => {
      await invalidateInventoryQueries(queryClient);
      resetForm();
      onSuccess?.(inventory);
    },
    onError: error => {
      setSubmitError(error.message || '入库失败');
    },
  });
}

function useUpdateMutation({
  queryClient,
  onSuccess,
  setSubmitError,
  mode,
  resetForm,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  onSuccess?: (result: Inventory) => void;
  setSubmitError: (value: string) => void;
  mode: OperationMode;
  resetForm: () => void;
}): UpdateMutationResult {
  return useMutation<Inventory, Error, UpdateMutationVariables>({
    mutationFn: async variables => {
      if (mode === 'adjust') {
        return adjustInventory(variables as InventoryAdjustInput);
      }
      return createOutbound(variables as OutboundCreateInput);
    },
    onSuccess: async inventory => {
      await invalidateInventoryQueries(queryClient);
      resetForm();
      onSuccess?.(inventory);
    },
    onError: error => {
      setSubmitError(error.message || '操作失败');
    },
  });
}

function combineLoadingState({
  createMutation,
  updateMutation,
  availabilityQuery,
}: {
  createMutation: CreateMutationResult;
  updateMutation: UpdateMutationResult;
  availabilityQuery: ReturnType<typeof useAvailabilityData>;
}) {
  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    availabilityQuery.isLoading;

  return {
    isLoading,
  };
}

async function invalidateInventoryQueries(
  queryClient: ReturnType<typeof useQueryClient>
) {
  // ✅ 使用 refetchQueries 强制立即刷新，确保用户操作库存后立即看到变化
  await queryClient.refetchQueries({
    queryKey: queryKeys.inventory.lists(),
    type: 'active',
  });
  await queryClient.refetchQueries({
    queryKey: queryKeys.inventory.all,
    type: 'active',
  });
}

function normalizeInboundValues(values: CreateInboundData): CreateInboundData {
  return {
    ...values,
    idempotencyKey: values.idempotencyKey || generateIdempotencyKey(),
    batchNumber: normalizeOptionalText(values.batchNumber),
    remarks: normalizeOptionalText(values.remarks),
    variantId: normalizeOptionalText(values.variantId),
  } as CreateInboundData;
}

function normalizeOutboundValues(
  values: OutboundCreateFormData
): OutboundCreateInput {
  return {
    idempotencyKey: values.idempotencyKey || generateIdempotencyKey(),
    type: values.type,
    productId: values.productId,
    batchNumber: normalizeOptionalText(values.batchNumber),
    quantity: values.quantity,
    unitCost: values.unitCost,
    customerId: normalizeOptionalText(values.customerId),
    salesOrderId: normalizeOptionalText(values.salesOrderId),
    remarks: normalizeOptionalText(values.remarks),
    variantId: normalizeOptionalText(values.variantId),
    reason: normalizeOptionalText(values.reason),
    notes: normalizeOptionalText(values.notes),
  };
}

function normalizeAdjustValues(
  values: InventoryAdjustFormData
): InventoryAdjustInput {
  return {
    idempotencyKey: values.idempotencyKey || generateIdempotencyKey(),
    productId: values.productId,
    batchNumber: normalizeOptionalText(values.batchNumber),
    adjustQuantity: values.adjustQuantity,
    reason: values.reason,
    notes: normalizeOptionalText(values.notes),
    variantId: normalizeOptionalText(values.variantId),
    currentQuantity: values.currentQuantity,
    maxQuantity: values.maxQuantity,
    minQuantity: values.minQuantity,
  };
}

function normalizeOptionalText<T extends string | undefined | null>(
  value: T
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export type { FormValuesByMode };
