'use client';

import { AlertCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  InboundCostField,
  InboundOptionalFields,
  InboundQuantityFields,
  InboundReasonField,
  InboundSpecificationFields,
} from '@/components/inventory/forms/inbound-form-fields';
import { InboundFormToolbar } from '@/components/inventory/forms/inbound-form-toolbar';
import { InboundProductSection } from '@/components/inventory/forms/inbound-product-section';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form } from '@/components/ui/form';
import {
  calculateFinalQuantity,
  useInboundForm,
  useProductSelection,
} from '@/hooks/use-inbound-form';
import { useInboundFormSubmit } from '@/hooks/use-inbound-form-submit';
import type { InboundFormData, ProductOption } from '@/lib/types/inbound';

interface ERPInboundFormProps {
  onSuccess?: () => void;
}

/**
 * ERP风格产品入库表单组件
 * 符合中国ERP系统的紧凑布局和操作习惯
 * ✅ 符合产品模块UI风格规范
 */
export function ERPInboundForm({ onSuccess }: ERPInboundFormProps) {
  const [showProductPrompt, setShowProductPrompt] = useState(false);
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
  } = useInboundForm({
    initialReason: isOpeningBalance ? 'opening_balance' : 'purchase',
  });

  // 产品选择逻辑
  const { handleProductSelect, handleReset } = useProductSelection(
    form,
    setSelectedProduct
  );

  // 表单提交逻辑
  const { handleSubmit: submitInbound, isSubmitting } = useInboundFormSubmit({
    createMutation,
    onSuccess,
  });

  // ✅ 修复: 使用类型断言以兼容 standardSchemaResolver
  const handleFormSubmit = form.handleSubmit(
    async (data: any) => {
      setShowProductPrompt(false);
      await submitInbound(data as InboundFormData);
    },
    errors => {
      if (errors.productId) {
        setShowProductPrompt(true);
        form.setFocus('productId');
      } else {
        setShowProductPrompt(false);
      }
    }
  );

  const handleToolbarSubmit = () => {
    if (!form.getValues('productId')) {
      setShowProductPrompt(true);
      form.setFocus('productId');
    }

    // ✅ 调用 handleFormSubmit 并捕获未处理的 Promise rejection
    // React Hook Form 的 handleSubmit 行为：
    // - 验证失败：调用 onInvalid 回调，Promise resolve（不会 reject）
    // - 验证成功但提交失败：Promise reject（需要捕获）
    // submitInbound 内部已经处理了所有提交错误（显示 Toast 等）
    // 这里只需要防止未捕获的 Promise rejection
    handleFormSubmit().catch(() => {
      // submitInbound 已经处理了错误，这里不需要额外操作
      // 只是为了防止 "Uncaught (in promise)" 错误
    });
  };

  const handleProductSelectWithPrompt = (product: ProductOption) => {
    setShowProductPrompt(false);
    handleProductSelect(product);
  };

  const handleFormReset = () => {
    setShowProductPrompt(false);
    handleReset();
  };

  // 实时计算并更新最终片数
  useEffect(() => {
    if (watchedInputQuantity > 0 && watchedPiecesPerUnit > 0) {
      const finalQuantity = calculateFinalQuantity(
        watchedInputQuantity,
        watchedInputUnit,
        watchedPiecesPerUnit
      );
      form.setValue('quantity', finalQuantity);
    } else {
      form.setValue('quantity', undefined); // ✅ 修改：设置为 undefined 而不是 0
    }
  }, [watchedInputQuantity, watchedInputUnit, watchedPiecesPerUnit, form]);

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-4">
        {/* 页面标题卡片 */}
        <InboundFormToolbar
          isSubmitting={isSubmitting}
          onReset={handleFormReset}
          onSubmit={handleToolbarSubmit}
        />

        {/* 期初入库提示 Banner */}
        {isOpeningBalance && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">期初入库操作</AlertTitle>
            <AlertDescription className="text-amber-800">
              您正在创建期初入库记录，此操作将影响库存期初数据。请确保录入的数据准确无误。
            </AlertDescription>
          </Alert>
        )}

        {/* 表单内容区域 */}
        <div className="overflow-hidden rounded-lg border bg-white shadow-md">
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={handleFormSubmit} className="space-y-6">
                {/* 产品选择区域 */}
                <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4">
                  <InboundProductSection
                    form={form}
                    selectedProduct={selectedProduct}
                    onProductSelect={handleProductSelectWithPrompt}
                    showProductPrompt={showProductPrompt}
                  />
                </div>

                {/* 入库数量信息 */}
                <InboundQuantityFields form={form} />

                {/* 产品规格信息 */}
                <InboundSpecificationFields form={form} />

                {/* 单位成本 */}
                <InboundCostField form={form} />

                {/* 入库原因 */}
                <InboundReasonField form={form} />

                {/* 可选信息 */}
                <div className="border-t pt-4">
                  <InboundOptionalFields form={form} />
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
