'use client';

import React, { useEffect } from 'react';

import {
  InboundOptionalFields,
  InboundQuantityFields,
  InboundReasonField,
  InboundSpecificationFields,
} from '@/components/inventory/forms/inbound-form-fields';
import { InboundFormToolbar } from '@/components/inventory/forms/inbound-form-toolbar';
import { InboundProductSection } from '@/components/inventory/forms/inbound-product-section';
import { Form } from '@/components/ui/form';
import {
  calculateFinalQuantity,
  useInboundForm,
  useProductSelection,
} from '@/hooks/use-inbound-form';
import { useInboundFormSubmit } from '@/hooks/use-inbound-form-submit';

interface ERPInboundFormProps {
  onSuccess?: () => void;
}

/**
 * ERP风格产品入库表单组件
 * 符合中国ERP系统的紧凑布局和操作习惯
 */
export function ERPInboundForm({ onSuccess }: ERPInboundFormProps) {
  // 使用自定义Hook管理表单状态
  const {
    form,
    isSubmitting,
    setIsSubmitting,
    selectedProduct,
    setSelectedProduct,
    createMutation,
    watchedInputQuantity,
    watchedInputUnit,
    watchedPiecesPerUnit,
  } = useInboundForm();

  // 产品选择逻辑
  const { handleProductSelect, handleReset } = useProductSelection(
    form,
    setSelectedProduct
  );

  // 表单提交逻辑
  const { onSubmit } = useInboundFormSubmit({
    createMutation,
    setIsSubmitting,
    onSuccess,
  });

  // 实时计算并更新最终片数
  useEffect(() => {
    if (watchedInputQuantity > 0 && watchedPiecesPerUnit > 0) {
      const finalQuantity = calculateFinalQuantity(
        watchedInputQuantity,
        watchedInputUnit,
        watchedPiecesPerUnit
      );
      form.setValue('quantity', finalQuantity);
    }
  }, [watchedInputQuantity, watchedInputUnit, watchedPiecesPerUnit, form]);

  return (
    <div className="rounded border bg-card">
      {/* ERP标准工具栏 */}
      <InboundFormToolbar
        isSubmitting={isSubmitting}
        onReset={handleReset}
        onSubmit={form.handleSubmit(onSubmit)}
      />

      {/* 表单内容区域 */}
      <div className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 产品选择区域 */}
            <InboundProductSection
              form={form}
              selectedProduct={selectedProduct}
              onProductSelect={handleProductSelect}
            />

            {/* 入库数量信息 */}
            <div className="space-y-4">
              <h3 className="text-base font-medium">入库数量</h3>
              <InboundQuantityFields form={form} />
            </div>

            {/* 产品规格信息 */}
            <div className="space-y-4">
              <h3 className="text-base font-medium">产品规格</h3>
              <InboundSpecificationFields form={form} />
            </div>

            {/* 入库原因 */}
            <div className="space-y-4">
              <h3 className="text-base font-medium">入库原因</h3>
              <InboundReasonField form={form} />
            </div>

            {/* 可选信息 */}
            <div className="space-y-4">
              <h3 className="text-base font-medium">可选信息</h3>
              <InboundOptionalFields form={form} />
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
