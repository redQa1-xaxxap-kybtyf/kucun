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

export function InboundProductSection({
  form,
  selectedProduct,
  onProductSelect,
}: InboundProductSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium">产品信息</h3>

      {/* 产品选择 */}
      <FormField
        control={form.control}
        name="productId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">选择产品 *</FormLabel>
            <FormControl>
              <ProductSelector
                value={field.value}
                onChange={(productId, product) => {
                  field.onChange(productId);
                  if (product) {
                    onProductSelect(product);
                  }
                }}
                placeholder="请选择要入库的产品"
                className="h-9"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 选中产品信息展示 */}
      {selectedProduct && (
        <div className="rounded border bg-muted/30 p-4">
          <h4 className="mb-2 text-sm font-medium">已选择产品</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">产品编码：</span>
              <span className="font-medium">{selectedProduct.code}</span>
            </div>
            <div>
              <span className="text-muted-foreground">产品名称：</span>
              <span className="font-medium">{selectedProduct.label}</span>
            </div>
            <div>
              <span className="text-muted-foreground">单位：</span>
              <span className="font-medium">{selectedProduct.unit}</span>
            </div>
            <div>
              <span className="text-muted-foreground">每件片数：</span>
              <span className="font-medium">
                {selectedProduct.piecesPerUnit || 1} 片
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">当前库存：</span>
              <span className="font-medium">
                {selectedProduct.currentStock || 0} 片
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
