'use client';

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

interface InboundProductSectionProps {
  form: UseFormReturn<InboundFormData>;
  selectedProduct: ProductOption | null;
  onProductSelect: (product: ProductOption) => void;
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
}: InboundProductSectionProps) {
  return (
    <div className="space-y-3">
      {/* 产品搜索 */}
      <FormField
        control={form.control}
        name="productId"
        render={({ field }) => (
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
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 选中产品信息展示 */}
      {selectedProduct && (
        <div className="rounded-md border border-green-300 bg-green-50/50 p-3">
          <div className="grid grid-cols-5 gap-x-4 gap-y-2 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">产品编码</span>
              <span className="font-semibold text-blue-700">
                {selectedProduct.code}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">产品名称</span>
              <span className="font-semibold text-gray-900">
                {selectedProduct.label}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">单位</span>
              <span className="font-medium text-gray-800">
                {getChineseUnit(selectedProduct.unit)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">每件片数</span>
              <span className="font-medium text-gray-800">
                {selectedProduct.piecesPerUnit || 1} 片
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-600">当前库存</span>
              <span className="font-semibold text-emerald-700">
                {selectedProduct.currentStock || 0} 片
              </span>
            </div>
            {selectedProduct.batchSpecs &&
              selectedProduct.batchSpecs.length > 0 && (
                <div className="col-span-5 flex flex-col gap-1.5 border-t border-green-200 pt-2">
                  <span className="font-medium text-gray-600">
                    现有批次规格
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {selectedProduct.batchSpecs.map((spec, index) => {
                      // 计算件数和剩余片数
                      const units = Math.floor(
                        spec.quantity / spec.piecesPerUnit
                      );
                      const remainingPieces =
                        spec.quantity % spec.piecesPerUnit;

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
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-1.5"
                        >
                          <span className="font-mono text-xs font-semibold text-blue-800">
                            {spec.batchNumber}
                          </span>
                          <span className="text-gray-400">|</span>
                          <span className="text-xs text-gray-700">
                            每件{' '}
                            <span className="font-semibold text-blue-700">
                              {spec.piecesPerUnit}
                            </span>{' '}
                            片
                          </span>
                          <span className="text-gray-400">|</span>
                          <span className="text-xs text-emerald-700">
                            库存{' '}
                            <span className="font-semibold">
                              {stockDisplay}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
