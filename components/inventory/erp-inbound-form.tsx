'use client';

import {
  AlertCircle,
  BarChart3,
  ClipboardList,
  FileText,
  Package,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import {
  BatchPurchaseInboundSection,
  createBatchPurchaseInboundRow,
  type BatchPurchaseInboundRow,
  type BatchPurchaseInboundRowErrors,
} from '@/components/inventory/forms/batch-purchase-inbound-section';
import {
  InboundCostField,
  InboundPurchaseDamageSection,
  InboundQuantityFields,
  InboundReasonField,
  InboundSpecificationFields,
  InboundSupplierField,
  InboundTotalCostField,
} from '@/components/inventory/forms/inbound-form-fields';
import { InboundFormToolbar } from '@/components/inventory/forms/inbound-form-toolbar';
import { InboundProductSection } from '@/components/inventory/forms/inbound-product-section';
import { OpeningBalanceConfirmDialog } from '@/components/inventory/opening-balance-confirm-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useBatchInboundFormSubmit } from '@/hooks/use-batch-inbound-form-submit';
import {
  calculateAcceptedInboundQuantity,
  useInboundForm,
  useProductSelection,
} from '@/hooks/use-inbound-form';
import { useInboundFormSubmit } from '@/hooks/use-inbound-form-submit';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useCreateBatchInboundRecords } from '@/lib/api/inbound';
import {
  INBOUND_REASON_LABELS,
  type InboundFormData,
  type ProductOption,
} from '@/lib/types/inbound';
import { showError } from '@/lib/utils/toast-helper';
import { createInboundSchema } from '@/lib/validations/inbound';

interface ERPInboundFormProps {
  onSuccess?: () => void;
}

/**
 * ERP风格产品入库表单组件
 *
 * ✅ 优化亮点：
 * 1. 紧凑布局：产品与供应商合并，批次与数量规格合并
 * 2. 视觉层次清晰：使用lucide-react专业图标，每组独特配色
 * 3. 符合操作流程：按用户自然思维顺序排列字段
 * 4. 空间利用合理：减少分组数量，优化垂直空间
 * 5. 现代化设计：增强边框和标题，提升视觉对比度
 */
export function ERPInboundForm({ onSuccess }: ERPInboundFormProps) {
  const router = useRouter();
  const inboundFormId = 'erp-inbound-form';
  const [showProductPrompt, setShowProductPrompt] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showReasonSwitcher, setShowReasonSwitcher] = useState(false);
  const [showSingleOptionalFields, setShowSingleOptionalFields] =
    useState(false);
  const [showPurchaseDamageSection, setShowPurchaseDamageSection] =
    useState(false);
  const [pendingFormData, setPendingFormData] =
    useState<InboundFormData | null>(null);
  const [isBatchPurchaseMode, setIsBatchPurchaseMode] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchPurchaseInboundRow[]>([
    createBatchPurchaseInboundRow(),
  ]);
  const [batchSelectedProducts, setBatchSelectedProducts] = useState<
    Record<string, ProductOption | null>
  >({});
  const [batchRowErrors, setBatchRowErrors] = useState<
    Record<string, BatchPurchaseInboundRowErrors>
  >({});
  const searchParams = useSearchParams();

  // 检测是否为期初入库操作
  const isOpeningBalance = searchParams.get('type') === 'opening_balance';

  // 使用自定义Hook管理表单状态
  // ✅ 修复：根据 URL 参数设置初始 reason 值
  const {
    form,
    selectedProduct,
    setSelectedProduct,
    createMutation,
    watchedInputQuantity,
    watchedInputUnit,
    watchedPiecesPerUnit,
    watchedDamagedInputQuantity,
  } = useInboundForm({
    initialReason: isOpeningBalance ? 'opening_balance' : 'purchase',
  });
  const watchedReason = form.watch('reason');
  const watchedDamageHandling = form.watch('damageHandling');
  const watchedDamageRemarks = form.watch('damageRemarks');
  const hasPurchaseDamage =
    watchedDamagedInputQuantity > 0 ||
    Boolean(watchedDamageHandling) ||
    Boolean(watchedDamageRemarks?.trim());
  const shouldShowPurchaseDamageTools =
    watchedReason === 'purchase' && !isBatchPurchaseMode;
  const isPurchaseDamageSectionVisible =
    shouldShowPurchaseDamageTools &&
    (showPurchaseDamageSection || hasPurchaseDamage);
  const shouldShowSingleOptionalFields =
    !isBatchPurchaseMode &&
    (showSingleOptionalFields || watchedInputUnit === 'units');
  const batchCreateMutation = useCreateBatchInboundRecords();
  const currentPageTitle = isOpeningBalance
    ? '期初库存录入'
    : watchedReason === 'purchase'
      ? '手工采购入库'
      : INBOUND_REASON_LABELS[watchedReason];
  const currentPageDescription = isOpeningBalance
    ? '把期初数量和成本录进去，提交后库存就会生效。'
    : watchedReason === 'purchase'
      ? isBatchPurchaseMode
        ? '同一供应商这次到货的多种产品，可以一次录完。'
        : '按供应商、产品、批次、数量、成本顺着填就行。'
      : '按实际业务填写即可，提交后会生成入库单。';
  const submitLabel = isOpeningBalance ? '确认录入期初库存' : '确认提交入库';

  // 产品选择逻辑
  const { handleProductSelect, handleReset } = useProductSelection(
    form,
    setSelectedProduct
  );

  // 表单提交逻辑（不跳过确认）
  const { handleSubmit: submitInbound, isSubmitting } = useInboundFormSubmit({
    createMutation,
    onSuccess,
    skipConfirm: false,
  });

  // 表单提交逻辑（跳过确认，用于用户已确认后的实际提交）
  const {
    handleSubmit: submitInboundWithoutConfirm,
    isSubmitting: isConfirmSubmitting,
  } = useInboundFormSubmit({
    createMutation,
    onSuccess,
    skipConfirm: true,
  });
  const { handleSubmit: submitBatchInbound, isSubmitting: isBatchSubmitting } =
    useBatchInboundFormSubmit({
      createMutation: batchCreateMutation,
      onSuccess,
    });
  const hasUnsavedChanges =
    form.formState.isDirty &&
    !(isSubmitting || isConfirmSubmitting || isBatchSubmitting);
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前入库单内容尚未保存，确定要离开吗？',
  });

  const generateIdempotencyKey = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const resetPurchaseDamageFields = () => {
    form.setValue('damagedInputQuantity', undefined, {
      shouldDirty: false,
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
  };

  const handlePurchaseDamageToggle = () => {
    if (isPurchaseDamageSectionVisible) {
      setShowPurchaseDamageSection(false);
      resetPurchaseDamageFields();
      return;
    }

    setShowPurchaseDamageSection(true);
  };

  const handleBatchRowChange = <K extends keyof BatchPurchaseInboundRow>(
    rowId: string,
    field: K,
    value: BatchPurchaseInboundRow[K]
  ) => {
    setBatchRows(current =>
      current.map(row =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
              ...(field === 'damagedInputQuantity' &&
              (!value || Number(value) <= 0)
                ? {
                    damageHandling: undefined,
                    damageRemarks: '',
                  }
                : {}),
            }
          : row
      )
    );

    setBatchRowErrors(current => ({
      ...current,
      [rowId]: {
        ...current[rowId],
        [field]: undefined,
      },
    }));
  };

  const handleBatchProductSelect = (
    rowId: string,
    productId: string,
    product?: ProductOption
  ) => {
    setBatchRows(current =>
      current.map(row =>
        row.id === rowId
          ? {
              ...row,
              productId,
              piecesPerUnit: undefined,
              weight: undefined,
            }
          : row
      )
    );

    setBatchSelectedProducts(current => ({
      ...current,
      [rowId]: product ?? null,
    }));

    setBatchRowErrors(current => ({
      ...current,
      [rowId]: {
        ...current[rowId],
        productId: undefined,
      },
    }));
  };

  const handleAddBatchRow = () => {
    setBatchRows(current => [...current, createBatchPurchaseInboundRow()]);
  };

  const handleRemoveBatchRow = (rowId: string) => {
    setBatchRows(current =>
      current.length === 1 ? current : current.filter(row => row.id !== rowId)
    );

    setBatchSelectedProducts(current => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });

    setBatchRowErrors(current => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  };

  const handleBatchSubmit = async () => {
    const supplierId = form.getValues('supplierId')?.trim();
    const commonRemarks = form.getValues('remarks')?.trim();

    const buildBatchErrorDescription = (
      errors: Record<string, BatchPurchaseInboundRowErrors>
    ) => {
      const fieldPriority: (keyof BatchPurchaseInboundRowErrors)[] = [
        'productId',
        'batchNumber',
        'inputQuantity',
        'piecesPerUnit',
        'damagedInputQuantity',
        'damageHandling',
        'unitCost',
      ];

      for (const [index, row] of batchRows.entries()) {
        const rowError = errors[row.id];
        if (!rowError) {
          continue;
        }

        const firstMessage =
          fieldPriority
            .map(field => rowError[field])
            .find(
              value => typeof value === 'string' && value.trim().length > 0
            ) ??
          Object.values(rowError).find(
            value => typeof value === 'string' && value.trim().length > 0
          );

        if (firstMessage) {
          return `第 ${index + 1} 条明细：${firstMessage}`;
        }
      }

      return '请先把每条明细的必填项补完整后再提交。';
    };

    if (!supplierId) {
      form.setError('supplierId', {
        type: 'manual',
        message: '请选择供应商',
      });
      showError('提交前还有内容没填完整', {
        description: '请先选择供应商后再提交。',
      });
      return;
    }

    const nextErrors: Record<string, BatchPurchaseInboundRowErrors> = {};
    const records = batchRows.flatMap(row => {
      const quantities = calculateAcceptedInboundQuantity({
        reason: 'purchase',
        inputQuantity: row.inputQuantity,
        damagedInputQuantity: row.damagedInputQuantity,
        inputUnit: row.inputUnit,
        piecesPerUnit: row.piecesPerUnit,
      });

      const parsed = createInboundSchema.safeParse({
        idempotencyKey: generateIdempotencyKey(),
        productId: row.productId,
        inputQuantity: row.inputQuantity,
        inputUnit: row.inputUnit,
        quantity: quantities.quantity,
        unitCost: row.unitCost,
        reason: 'purchase' as const,
        supplierId,
        remarks: commonRemarks || undefined,
        batchNumber: row.batchNumber.trim(),
        piecesPerUnit: row.piecesPerUnit,
        weight: row.weight,
        damagedInputQuantity: row.damagedInputQuantity,
        damagedQuantity: quantities.damagedQuantity,
        damageHandling: row.damageHandling,
        damageRemarks: row.damageRemarks.trim() || undefined,
      });

      if (!parsed.success) {
        const rowFieldErrors: BatchPurchaseInboundRowErrors = {};

        parsed.error.issues.forEach(issue => {
          const field = issue.path[0];
          if (
            typeof field === 'string' &&
            !rowFieldErrors[field as keyof BatchPurchaseInboundRowErrors]
          ) {
            rowFieldErrors[field as keyof BatchPurchaseInboundRowErrors] =
              issue.message;
          }
        });

        if (
          row.inputUnit === 'units' &&
          (!row.piecesPerUnit || row.piecesPerUnit <= 0) &&
          !rowFieldErrors.piecesPerUnit
        ) {
          rowFieldErrors.piecesPerUnit = '按件入库时必须填写装箱数';
        }

        if (
          (row.damagedInputQuantity ?? 0) > 0 &&
          !row.damageHandling &&
          !rowFieldErrors.damageHandling
        ) {
          rowFieldErrors.damageHandling = '有到货破损时必须选择处理方式';
        }

        nextErrors[row.id] = rowFieldErrors;
        return [];
      }

      return [parsed.data];
    });

    setBatchRowErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || records.length === 0) {
      showError('提交前还有内容没填完整', {
        description: buildBatchErrorDescription(nextErrors),
      });
      return;
    }

    await submitBatchInbound({
      batchIdempotencyKey: generateIdempotencyKey(),
      records,
    });
  };

  const getFirstErrorMessage = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as Record<string, unknown>;

    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }

    for (const nestedValue of Object.values(record)) {
      const nestedMessage = getFirstErrorMessage(nestedValue);
      if (nestedMessage) {
        return nestedMessage;
      }
    }

    return undefined;
  };

  const getPreferredSingleErrorMessage = (
    value: unknown
  ): string | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const errors = value as Partial<Record<keyof InboundFormData, unknown>>;
    const fieldPriority: (keyof InboundFormData)[] = [
      'supplierId',
      'productId',
      'batchNumber',
      'inputQuantity',
      ...(watchedInputUnit === 'units' ? (['piecesPerUnit'] as const) : []),
      'damagedInputQuantity',
      'damageHandling',
      'unitCost',
      'quantity',
    ];

    for (const field of fieldPriority) {
      const fieldMessage = getFirstErrorMessage(errors[field]);
      if (fieldMessage) {
        return fieldMessage;
      }
    }

    return getFirstErrorMessage(errors);
  };

  // ✅ 使用 React Hook Form 的 handleSubmit，并在这里处理期初入库二次确认逻辑
  const handleFormSubmit = form.handleSubmit(
    async (data: any) => {
      setShowProductPrompt(false);
      const typedData = data as InboundFormData;

      // 期初入库：先弹出确认对话框，不直接提交
      if (typedData.reason === 'opening_balance') {
        setPendingFormData(typedData);
        setShowConfirmDialog(true);
        return;
      }

      // 普通入库：直接提交
      await submitInbound(typedData);
    },
    errors => {
      if (errors.productId) {
        setShowProductPrompt(true);
        form.setFocus('productId');
      } else {
        setShowProductPrompt(false);
      }

      showError('提交前还有内容没填完整', {
        description:
          getPreferredSingleErrorMessage(errors) ??
          '请先把必填项补完整后再提交。',
      });
    }
  );

  const handleProductSelectWithPrompt = (product: ProductOption | null) => {
    setShowProductPrompt(false);
    handleProductSelect(product);
  };

  const handleFormReset = () => {
    setShowProductPrompt(false);
    setShowConfirmDialog(false);
    setShowReasonSwitcher(false);
    setShowSingleOptionalFields(false);
    setShowPurchaseDamageSection(false);
    setPendingFormData(null);
    setBatchRows([createBatchPurchaseInboundRow()]);
    setBatchSelectedProducts({});
    setBatchRowErrors({});
    handleReset();
  };

  // 期初入库确认对话框的处理函数
  const handleConfirmDialogConfirm = async () => {
    if (pendingFormData) {
      try {
        await submitInboundWithoutConfirm(pendingFormData);
      } catch (error) {
        // 错误已经在 submitInboundWithoutConfirm 中处理
        console.error('提交失败:', error);
      } finally {
        setPendingFormData(null);
      }
    }
  };

  const handleConfirmDialogCancel = () => {
    setPendingFormData(null);
  };

  const handleBack = () => {
    if (!confirmLeavePage()) {
      return;
    }

    router.back();
  };

  // 实时计算并更新到货破损与合格入库片数
  useEffect(() => {
    const { quantity, damagedQuantity } = calculateAcceptedInboundQuantity({
      reason: watchedReason,
      inputQuantity:
        watchedInputQuantity > 0 ? watchedInputQuantity : undefined,
      damagedInputQuantity:
        watchedDamagedInputQuantity > 0
          ? watchedDamagedInputQuantity
          : undefined,
      inputUnit: watchedInputUnit,
      piecesPerUnit: watchedPiecesPerUnit,
    });

    form.setValue('quantity', quantity, {
      shouldDirty: false,
      shouldValidate: false,
    });
    form.setValue('damagedQuantity', damagedQuantity, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [
    watchedReason,
    watchedDamagedInputQuantity,
    watchedInputQuantity,
    watchedInputUnit,
    watchedPiecesPerUnit,
    form,
  ]);

  useEffect(() => {
    if (watchedReason === 'purchase') {
      return;
    }

    setShowPurchaseDamageSection(false);
    resetPurchaseDamageFields();
  }, [watchedReason]);

  useEffect(() => {
    if (watchedReason !== 'purchase' && isBatchPurchaseMode) {
      setIsBatchPurchaseMode(false);
    }
  }, [isBatchPurchaseMode, watchedReason]);

  useEffect(() => {
    if (!hasPurchaseDamage) {
      return;
    }

    setShowPurchaseDamageSection(true);
  }, [hasPurchaseDamage]);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4">
        {/* 页面标题卡片 */}
        <InboundFormToolbar
          isSubmitting={
            isSubmitting || isConfirmSubmitting || isBatchSubmitting
          }
          onReset={handleFormReset}
          onBack={handleBack}
          title={currentPageTitle}
          description={currentPageDescription}
          submitLabel={submitLabel}
          formId={inboundFormId}
        />

        {/* 期初入库提示 Banner */}
        {isOpeningBalance && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">正在录入期初库存</AlertTitle>
            <AlertDescription className="text-amber-800">
              提交后库存立即生效。
            </AlertDescription>
          </Alert>
        )}

        {/* 表单内容区域 */}
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <Form {...form}>
              <form
                id={inboundFormId}
                onSubmit={
                  isBatchPurchaseMode
                    ? event => {
                        event.preventDefault();
                        handleBatchSubmit().catch(() => {
                          // submitBatchInbound 已处理错误提示
                        });
                      }
                    : handleFormSubmit
                }
                className="space-y-6"
              >
                {/* 1️⃣ 入库类型 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-semibold tracking-tight text-slate-900">
                        1. 入库类型
                      </h3>
                      <p className="text-xs text-slate-500">默认采购入库。</p>
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50/30 p-6">
                    {watchedReason === 'purchase' && (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="space-y-2">
                            <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                              当前类型：采购入库
                            </div>
                            <p className="text-sm text-slate-500">
                              按本次收货填写。
                            </p>
                          </div>
                          {!isOpeningBalance && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setShowReasonSwitcher(current => !current)
                              }
                              className="border-dashed"
                            >
                              {showReasonSwitcher
                                ? '收起类型切换'
                                : '切换其他入库类型'}
                            </Button>
                          )}
                        </div>
                        {(showReasonSwitcher ||
                          watchedReason !== 'purchase') && (
                          <div className="border-t border-slate-100/70 pt-4">
                            <InboundReasonField form={form} />
                          </div>
                        )}
                        <div className="border-t border-slate-100/70 pt-4">
                          <p className="text-sm font-semibold text-slate-700">
                            录单方式
                          </p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <Button
                              type="button"
                              variant={
                                isBatchPurchaseMode ? 'outline' : 'default'
                              }
                              className="justify-start"
                              onClick={() => {
                                setIsBatchPurchaseMode(false);
                                setShowProductPrompt(false);
                              }}
                            >
                              单产品录入
                            </Button>
                            <Button
                              type="button"
                              variant={
                                isBatchPurchaseMode ? 'default' : 'outline'
                              }
                              className="justify-start"
                              onClick={() => {
                                setIsBatchPurchaseMode(true);
                                setShowProductPrompt(false);
                              }}
                            >
                              批量多产品录入
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {watchedReason !== 'purchase' && !isOpeningBalance && (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="space-y-2">
                            <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                              当前类型：{INBOUND_REASON_LABELS[watchedReason]}
                            </div>
                            <p className="text-sm text-slate-500">
                              按当前类型入库。
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setShowReasonSwitcher(current => !current)
                            }
                            className="border-dashed"
                          >
                            {showReasonSwitcher
                              ? '收起类型切换'
                              : '切换其他入库类型'}
                          </Button>
                        </div>
                        <div className="border-t border-slate-100/70 pt-4">
                          <InboundReasonField form={form} />
                        </div>
                      </div>
                    )}
                    {isOpeningBalance && (
                      <div className="space-y-2">
                        <div className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                          当前类型：期初库存
                        </div>
                        <p className="text-sm text-slate-500">
                          直接填写数量和成本。
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2️⃣ 供应商与产品 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-semibold tracking-tight text-slate-900">
                        2. 供应商与产品
                      </h3>
                      <p className="text-xs text-slate-500">
                        先选供应商，再选产品。
                      </p>
                    </div>
                  </div>
                  <div className="space-y-6 rounded-md border border-slate-100 bg-slate-50/30 p-6">
                    <InboundSupplierField form={form} />
                    <div className="border-t border-slate-100/50 pt-6">
                      {isBatchPurchaseMode ? (
                        <BatchPurchaseInboundSection
                          rows={batchRows}
                          selectedProducts={batchSelectedProducts}
                          rowErrors={batchRowErrors}
                          onAddRow={handleAddBatchRow}
                          onRemoveRow={handleRemoveBatchRow}
                          onProductSelect={handleBatchProductSelect}
                          onFieldChange={handleBatchRowChange}
                        />
                      ) : (
                        <InboundProductSection
                          form={form}
                          selectedProduct={selectedProduct}
                          onProductSelect={handleProductSelectWithPrompt}
                          showProductPrompt={showProductPrompt}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {!isBatchPurchaseMode && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-base font-semibold tracking-tight text-slate-900">
                          3. 批次与数量
                        </h3>
                        <p className="text-xs text-slate-500">
                          填写批次和数量。
                        </p>
                      </div>
                    </div>
                    <div className="space-y-6 rounded-md border border-slate-100 bg-slate-50/30 p-6">
                      <FormField
                        control={form.control}
                        name="batchNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">
                              批次号/色号 *
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="请输入本次到货批次号或色号"
                                className="h-10 border-slate-200 bg-white/50 focus:bg-white"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="border-t border-slate-100/50 pt-4">
                        <InboundQuantityFields form={form} />
                      </div>

                      <div className="rounded-md border border-dashed border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              更多设置
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              按需要填写。
                            </p>
                          </div>
                          {watchedInputUnit !== 'units' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setShowSingleOptionalFields(current => !current)
                              }
                              className="border-dashed"
                            >
                              {shouldShowSingleOptionalFields
                                ? '收起更多设置'
                                : '展开更多设置'}
                            </Button>
                          )}
                        </div>
                        {shouldShowSingleOptionalFields && (
                          <div className="mt-4 border-t border-slate-100 pt-4">
                            <InboundSpecificationFields form={form} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {shouldShowPurchaseDamageTools && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-base font-semibold tracking-tight text-slate-900">
                          4. 到货破损
                        </h3>
                        <p className="text-xs text-slate-500">有破损再登记。</p>
                      </div>
                    </div>
                    <div className="rounded-md border border-amber-100 bg-amber-50/40 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-amber-900">
                            {isPurchaseDamageSectionVisible
                              ? '已开启到货破损登记'
                              : '本次到货没有破损，可直接继续'}
                          </p>
                          <p className="mt-1 text-xs text-amber-800">
                            提交后会从入库数量中扣除。
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant={
                            isPurchaseDamageSectionVisible
                              ? 'outline'
                              : 'default'
                          }
                          onClick={handlePurchaseDamageToggle}
                          className={
                            isPurchaseDamageSectionVisible
                              ? 'border-amber-200'
                              : ''
                          }
                        >
                          {isPurchaseDamageSectionVisible
                            ? '清空破损信息'
                            : '登记到货破损'}
                        </Button>
                      </div>
                      {isPurchaseDamageSectionVisible && (
                        <div className="mt-4 border-t border-amber-200/70 pt-4">
                          <InboundPurchaseDamageSection form={form} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isBatchPurchaseMode && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                        <ChineseYuan className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-base font-semibold tracking-tight text-slate-900">
                          {isPurchaseDamageSectionVisible
                            ? '5. 成本信息'
                            : '4. 成本信息'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          核对成本和金额。
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50/30 p-6">
                      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <InboundCostField form={form} />
                        <InboundTotalCostField form={form} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5️⃣ / 6️⃣ 备注 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-semibold tracking-tight text-slate-900">
                        {isBatchPurchaseMode
                          ? '3. 备注'
                          : isPurchaseDamageSectionVisible
                            ? '6. 备注'
                            : '5. 备注'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isBatchPurchaseMode ? '整单备注，可选。' : '可选。'}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50/30 p-6">
                    <FormField
                      control={form.control}
                      name="remarks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700">
                            备注
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="例如：司机已电话确认到货；本批次先入库后补单。"
                              className="min-h-[100px] resize-none border-slate-200 bg-white/50 focus:bg-white"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>

      {/* 期初入库确认对话框 */}
      <OpeningBalanceConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={handleConfirmDialogCancel}
        isSubmitting={isConfirmSubmitting}
      />
    </div>
  );
}
