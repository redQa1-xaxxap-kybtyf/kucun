'use client';

import type { UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import type { CreateSalesOrderData } from '@/lib/schemas/sales-order';
import type { Product } from '@/lib/types/product';

import { SmartProductSearch } from './smart-product-search';

interface IntelligentProductInputProps {
  form: UseFormReturn<CreateSalesOrderData>;
  index: number;
  products: Product[];
  onProductChange?: (product: Product | null) => void;
}

/**
 * 智能产品输入组件
 * 集成智能搜索和临时产品添加功能
 */
export function IntelligentProductInput({
  form,
  index,
  products,
  onProductChange,
}: IntelligentProductInputProps) {
  // 处理库存产品选择
  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      // 清空临时产品字段
      form.setValue(`items.${index}.isManualProduct`, false);
      form.setValue(`items.${index}.manualProductName`, '');
      form.setValue(`items.${index}.manualSpecification`, '');
      form.setValue(`items.${index}.manualWeight`, undefined);
      form.setValue(`items.${index}.manualUnit`, '');

      // 自动填充产品信息
      form.setValue(
        `items.${index}.specification`,
        product.specification || ''
      );
      form.setValue(`items.${index}.unit`, product.unit || '');
      form.setValue(
        `items.${index}.piecesPerUnit`,
        product.piecesPerUnit || undefined
      );

      onProductChange?.(product);
    }
  };

  // 处理临时产品添加
  const handleTemporaryProductAdd = (productData: {
    name: string;
    specification?: string;
    weight?: number;
    unit?: string;
  }) => {
    // 清空库存产品选择
    form.setValue(`items.${index}.productId`, '');

    // 设置临时产品标识和信息
    form.setValue(`items.${index}.isManualProduct`, true);
    form.setValue(`items.${index}.manualProductName`, productData.name);
    form.setValue(
      `items.${index}.manualSpecification`,
      productData.specification || ''
    );
    form.setValue(`items.${index}.manualWeight`, productData.weight);
    form.setValue(`items.${index}.manualUnit`, productData.unit || '');

    // 自动填充到表单的通用字段（用于显示）
    form.setValue(
      `items.${index}.specification`,
      productData.specification || ''
    );
    form.setValue(`items.${index}.unit`, productData.unit || '');

    onProductChange?.(null);
  };

  return (
    <FormField
      control={form.control}
      name={`items.${index}.productId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <SmartProductSearch
              products={products}
              value={field.value || ''}
              onValueChange={value => {
                field.onChange(value);
                handleProductSelect(value);
              }}
              onTemporaryProductAdd={handleTemporaryProductAdd}
              placeholder="搜索商品或添加临时商品"
              className="h-8 text-xs"
              allowTemporaryProducts={true}
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}
