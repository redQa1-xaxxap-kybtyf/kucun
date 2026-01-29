'use client';

import { useMemo } from 'react';
import { type UseFormReturn } from 'react-hook-form';

import { ProductSelector } from '@/components/inventory/product-selector';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { type InboundFormData, type ProductOption } from '@/lib/types/inbound';
import { cn } from '@/lib/utils';

// ✅ 修复: 使用泛型参数以兼容 standardSchemaResolver
interface InboundProductSectionProps {
  form: UseFormReturn<InboundFormData, any, any>;
  selectedProduct: ProductOption | null;
  onProductSelect: (product: ProductOption) => void;
  showProductPrompt?: boolean;
}

// 单位映射：英文 -> 中文
// 瓷砖行业专用：只使用"件"和"片"两种单位
const UNIT_MAP: Record<string, string> = {
  piece: '件',
  sheet: '片',
};

// 获取中文单位
function getChineseUnit(unit: string): string {
  return UNIT_MAP[unit.toLowerCase()] || unit;
}

export function InboundProductSection({
  form,
  selectedProduct,
  onProductSelect,
  showProductPrompt = false,
}: InboundProductSectionProps) {
  const selectedBatchNumber = form.watch('batchNumber');

  const batchSpecs = selectedProduct?.batchSpecs ?? [];
  const isMultipleBatches = batchSpecs.length > 1;
  const piecesPerUnitDisplay = useMemo(() => {
    if (!selectedProduct) {
      return '—';
    }

    if (
      !selectedProduct.batchSpecs ||
      selectedProduct.batchSpecs.length === 0
    ) {
      const fallback = selectedProduct.piecesPerUnit;
      return `${fallback ?? 1} 片`;
    }

    if (selectedProduct.batchSpecs.length === 1) {
      return `${selectedProduct.batchSpecs[0].piecesPerUnit} 片`;
    }

    return '多批次，请在下方选择批次';
  }, [selectedProduct]);

  const handleBatchSelect = (spec: {
    batchNumber: string;
    piecesPerUnit: number;
    quantity: number;
  }) => {
    form.setValue('batchNumber', spec.batchNumber, {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue('piecesPerUnit', spec.piecesPerUnit, {
      shouldDirty: true,
      shouldValidate: false,
    });
    // 重置数量，避免旧数据与新批次规格不一致
    form.setValue('inputQuantity', undefined, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue('quantity', 0, {
      shouldDirty: false,
      shouldValidate: false,
    });
    form.clearErrors(['batchNumber', 'piecesPerUnit', 'inputQuantity']);
  };

  const handleClearBatchSelection = () => {
    form.setValue('batchNumber', '', {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    const fallbackPiecesPerUnit = selectedProduct?.piecesPerUnit || undefined;
    form.setValue('piecesPerUnit', fallbackPiecesPerUnit, {
      shouldDirty: !!fallbackPiecesPerUnit,
      shouldValidate: false,
    });
    form.clearErrors(['batchNumber', 'piecesPerUnit']);
  };

  return (
    <div className="space-y-3">
      {/* 产品搜索 */}
      <FormField
        control={form.control}
        name="productId"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold text-gray-900">
              选择产品 *
            </FormLabel>
            <FormControl>
              <ProductSelector
                value={field.value}
                onChange={(productId, product) => {
                  field.onChange(productId);
                  if (product) {
                    onProductSelect(product);
                  }
                }}
                placeholder="搜索产品名称、编码..."
                error={fieldState.invalid || showProductPrompt}
              />
            </FormControl>
            <FormMessage>{showProductPrompt ? '请选择产品' : null}</FormMessage>
          </FormItem>
        )}
      />

      {/* 选中产品信息展示 */}
      {selectedProduct && (
        <div className="rounded-md border border-green-300 bg-green-50/50 p-3">
          <div className="grid grid-cols-6 gap-x-4 gap-y-2 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">产品名称</span>
              <span className="font-semibold text-gray-900">
                {selectedProduct.label}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">产品编码</span>
              <span className="font-semibold text-[hsl(var(--color-primary))]">
                {selectedProduct.code}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">规格</span>
              <span className="font-medium text-gray-800">
                {selectedProduct.specification || '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">单位</span>
              <span className="font-medium text-gray-800">
                {getChineseUnit(selectedProduct.unit)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">装箱数</span>
              <span
                className={cn(
                  'font-medium',
                  isMultipleBatches ? 'text-amber-600' : 'text-gray-800'
                )}
              >
                {piecesPerUnitDisplay}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">当前库存</span>
              <span className="font-semibold text-emerald-700">
                {selectedProduct.currentStock || 0} 片
              </span>
            </div>
            {batchSpecs.length > 0 && (
              <div className="col-span-5 flex flex-col gap-1.5 border-t border-green-200 pt-2">
                <span className="font-medium text-gray-600">现有批次规格</span>
                <p className="text-muted-foreground text-xs">
                  点击批次可快速切换入库批次，并同步装箱数。
                </p>
                <div className="flex flex-col gap-1.5">
                  {batchSpecs.map((spec, index) => {
                    // 计算件数和剩余片数
                    const units = Math.floor(
                      spec.quantity / spec.piecesPerUnit
                    );
                    const remainingPieces = spec.quantity % spec.piecesPerUnit;

                    // 格式化库存显示
                    let stockDisplay = '';
                    if (units > 0 && remainingPieces > 0) {
                      stockDisplay = `${units}件+${remainingPieces}片`;
                    } else if (units > 0) {
                      stockDisplay = `${units}件`;
                    } else {
                      stockDisplay = `${remainingPieces}片`;
                    }

                    return (
                      <button
                        type="button"
                        key={index}
                        onClick={() => handleBatchSelect(spec)}
                        className={cn(
                          'flex items-center gap-2 rounded border px-3 py-1.5 text-left transition',
                          selectedBatchNumber === spec.batchNumber
                            ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary-light))] shadow-sm'
                            : 'border-[hsl(var(--color-primary-light))] bg-[hsl(var(--color-primary-light))] hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))]'
                        )}
                      >
                        <span className="font-mono text-xs font-semibold text-[hsl(var(--color-primary))]">
                          {spec.batchNumber}
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="text-xs text-gray-700">
                          装箱数{' '}
                          <span className="font-semibold text-[hsl(var(--color-primary))]">
                            {spec.piecesPerUnit}
                          </span>{' '}
                          片
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="text-xs text-emerald-700">
                          库存{' '}
                          <span className="font-semibold">{stockDisplay}</span>
                          <span className="text-gray-500">
                            （共 {spec.quantity} 片）
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedBatchNumber && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-primary hover:text-primary/80 text-xs"
                      onClick={handleClearBatchSelection}
                    >
                      清除批次选择
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
