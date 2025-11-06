'use client';

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
import { Form } from '@/components/ui/form';
import {
  calculateFinalQuantity,
  useInboundForm,
  useProductSelection,
} from '@/hooks/use-inbound-form';
import { useInboundFormSubmit } from '@/hooks/use-inbound-form-submit';
import { type ProductOption } from '@/lib/types/inbound';
import { logger } from '@/lib/utils/console-logger';

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

  // 使用自定义Hook管理表单状态
  const {
    form,
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
  const { handleSubmit: submitInbound, isSubmitting } = useInboundFormSubmit({
    createMutation,
    onSuccess,
  });

  const handleFormSubmit = form.handleSubmit(
    async data => {
      setShowProductPrompt(false);
      await submitInbound(data);
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

  const handleToolbarSubmit = async () => {
    if (!form.getValues('productId')) {
      setShowProductPrompt(true);
      form.setFocus('productId');
    }

    try {
      await handleFormSubmit();
    } catch (error) {
      logger.error(
        'inventory:erp-inbound-form',
        '[ERPInboundForm] 表单提交失败',
        error
      );
    }
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
      form.setValue('quantity', 0);
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
