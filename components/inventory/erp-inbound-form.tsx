'use client';

import {
  AlertCircle,
  BarChart3,
  ClipboardList,
  DollarSign,
  FileText,
  Package,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  InboundCostField,
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
 *
 * ✅ 优化亮点：
 * 1. 紧凑布局：产品与供应商合并，批次与数量规格合并
 * 2. 视觉层次清晰：使用lucide-react专业图标，每组独特配色
 * 3. 符合操作流程：按用户自然思维顺序排列字段
 * 4. 空间利用合理：减少分组数量，优化垂直空间
 * 5. 现代化设计：增强边框和标题，提升视觉对比度
 */
export function ERPInboundForm({ onSuccess }: ERPInboundFormProps) {
  const [showProductPrompt, setShowProductPrompt] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] =
    useState<InboundFormData | null>(null);
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
    initialReason: isOpeningBalance ? 'opening_balance' : 'other',
  });

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
  const { handleSubmit: submitInboundWithoutConfirm } = useInboundFormSubmit({
    createMutation,
    onSuccess,
    skipConfirm: true,
  });

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
    setShowConfirmDialog(false);
    setPendingFormData(null);
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
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
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
              您正在创建期初入库记录。提交成功后会直接写入库存，无需额外审核；如果库存页暂时没看到，请先清空筛选或搜索条件再核对。
            </AlertDescription>
          </Alert>
        )}

        {/* 表单内容区域 */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={handleFormSubmit} className="space-y-6">
                {/* 1️⃣ 入库原因 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 shadow-inner">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-black tracking-tight text-slate-900">
                        1. 业务归置
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400">
                        设定本次入库的业务凭据与类型
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-6">
                    <InboundReasonField form={form} />
                  </div>
                </div>

                {/* 2️⃣ 产品与供应商 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 shadow-inner">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-black tracking-tight text-slate-900">
                        2. 标的与关系
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400">
                        选择入库产品与对应联络供应商
                      </p>
                    </div>
                  </div>
                  <div className="space-y-6 rounded-2xl border border-slate-100 bg-slate-50/30 p-6">
                    <InboundProductSection
                      form={form}
                      selectedProduct={selectedProduct}
                      onProductSelect={handleProductSelectWithPrompt}
                      showProductPrompt={showProductPrompt}
                    />
                    <div className="border-t border-slate-100/50 pt-4">
                      <InboundSupplierField form={form} />
                    </div>
                  </div>
                </div>

                {/* 3️⃣ 数量规格与批次 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 shadow-inner">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-black tracking-tight text-slate-900">
                        3. 交付效期
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400">
                        录入产品批次、色号及具体的入库数量
                      </p>
                    </div>
                  </div>
                  <div className="space-y-6 rounded-2xl border border-slate-100 bg-slate-50/30 p-6">
                    {/* 批次号 */}
                    <FormField
                      control={form.control}
                      name="batchNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-black text-slate-700">
                            产品批次/色号 *
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="请输入具体批次号或产品色号"
                              className="h-10 border-slate-200 bg-white/50 focus:bg-white"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] font-bold text-slate-400 italic">
                            行业规范：同一项目必须强制使用完全一致的批次/色号以防色差
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 入库数量、单位、最终片数 */}
                    <div className="border-t border-slate-100/50 pt-4">
                      <InboundQuantityFields form={form} />
                    </div>

                    {/* 每件片数、每件重量 */}
                    <div className="border-t border-slate-100/50 pt-4">
                      <InboundSpecificationFields form={form} />
                    </div>
                  </div>
                </div>

                {/* 4️⃣ 成本信息 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 shadow-inner">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-black tracking-tight text-slate-900">
                        4. 价值核算
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400">
                        核算入库资产的单位成本与总价值
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-6">
                    <div className="grid grid-cols-2 gap-6">
                      <InboundCostField form={form} />
                      <InboundTotalCostField form={form} />
                    </div>
                  </div>
                </div>

                {/* 5️⃣ 备注 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 shadow-inner">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-black tracking-tight text-slate-900">
                        5. 备注存证
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400">
                        记录本次入库的特殊变动或说明事项
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-6">
                    <FormField
                      control={form.control}
                      name="remarks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-black text-slate-700">
                            附加备注信息
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="系统将自动关联当前操作人与时间戳，如有特殊说明请在此记录..."
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
      />
    </div>
  );
}
