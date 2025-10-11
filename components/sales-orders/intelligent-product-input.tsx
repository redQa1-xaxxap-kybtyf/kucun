'use client';

import type { Path, PathValue, UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import type { Product } from '@/lib/types/product';

import { SmartProductSearch } from './smart-product-search';

interface IntelligentProductInputProps<
  TFieldValues extends Record<string, unknown> = Record<string, unknown>,
> {
  form: UseFormReturn<TFieldValues>;
  index: number;
  products: Product[];
  onProductChange?: (product: Product | null) => void;
  onBatchSelect?: (productId: string, batchNumber: string) => void;
}

/**
 * 智能产品输入组件
 * 集成智能搜索和临时产品添加功能
 */
export function IntelligentProductInput<
  TFieldValues extends Record<string, unknown> = Record<string, unknown>,
>({
  form,
  index,
  products,
  onProductChange,
  onBatchSelect,
}: IntelligentProductInputProps<TFieldValues>) {
  // 处理库存产品选择
  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      // 清空临时产品字段
      form.setValue(`items.${index}.isManualProduct` as unknown as Path<TFieldValues>, false as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
      form.setValue(`items.${index}.manualProductName` as unknown as Path<TFieldValues>, '' as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
      form.setValue(`items.${index}.manualSpecification` as unknown as Path<TFieldValues>, '' as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
      form.setValue(`items.${index}.manualWeight` as unknown as Path<TFieldValues>, undefined as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
      form.setValue(`items.${index}.manualUnit` as unknown as Path<TFieldValues>, '' as unknown as PathValue<TFieldValues, Path<TFieldValues>>);

      form.setValue(`items.${index}.productCode` as unknown as Path<TFieldValues>, (product.code || '') as unknown as PathValue<TFieldValues, Path<TFieldValues>>);

      // 自动填充产品信息
      form.setValue(
        `items.${index}.specification` as unknown as Path<TFieldValues>,
        (product.specification || '') as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );
      form.setValue(`items.${index}.unit` as unknown as Path<TFieldValues>, (product.unit || '') as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
      form.setValue(
        `items.${index}.piecesPerUnit` as unknown as Path<TFieldValues>,
        (product.piecesPerUnit || undefined) as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );
      form.setValue(`items.${index}.unitCost` as unknown as Path<TFieldValues>, undefined as unknown as PathValue<TFieldValues, Path<TFieldValues>>);

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
    form.setValue(`items.${index}.productId` as unknown as Path<TFieldValues>, '' as unknown as PathValue<TFieldValues, Path<TFieldValues>>);

    // 设置临时产品标识和信息
    form.setValue(`items.${index}.isManualProduct` as unknown as Path<TFieldValues>, true as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
    form.setValue(`items.${index}.manualProductName` as unknown as Path<TFieldValues>, productData.name as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
    form.setValue(
      `items.${index}.manualSpecification` as unknown as Path<TFieldValues>,
      (productData.specification || '') as unknown as PathValue<TFieldValues, Path<TFieldValues>>
    );
    form.setValue(`items.${index}.manualWeight` as unknown as Path<TFieldValues>, productData.weight as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
    form.setValue(`items.${index}.manualUnit` as unknown as Path<TFieldValues>, (productData.unit || '') as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
    form.setValue(`items.${index}.unitCost` as unknown as Path<TFieldValues>, undefined as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
    form.setValue(`items.${index}.productCode` as unknown as Path<TFieldValues>, '' as unknown as PathValue<TFieldValues, Path<TFieldValues>>);

    // 自动填充到表单的通用字段（用于显示）
    form.setValue(
      `items.${index}.specification` as unknown as Path<TFieldValues>,
      (productData.specification || '') as unknown as PathValue<TFieldValues, Path<TFieldValues>>
    );
    form.setValue(`items.${index}.unit` as unknown as Path<TFieldValues>, (productData.unit || '') as unknown as PathValue<TFieldValues, Path<TFieldValues>>);

    onProductChange?.(null);
  };

  // 转换产品数据格式以匹配 SmartProductSearch 的类型要求
  const productsWithInventory = products.map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    specification: p.specification,
    unit: p.unit,
    piecesPerUnit: p.piecesPerUnit,
    inventory: p.inventory
      ? {
          totalInventory: p.inventory.totalQuantity || 0,
          availableInventory: p.inventory.availableQuantity || 0,
          reservedInventory: p.inventory.reservedQuantity || 0,
          batches: p.inventory.batches
            ? p.inventory.batches.map(b => ({
                batchNumber: b.batchNumber,
                quantity: b.quantity,
              }))
            : undefined,
        }
      : null,
  }));

  return (
    <FormField
      control={form.control}
      name={`items.${index}.productId` as unknown as Path<TFieldValues>}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <SmartProductSearch
              products={productsWithInventory}
              value={(field.value as string) || ''}
              onValueChange={value => {
                field.onChange(value);
                handleProductSelect(value);
              }}
              onBatchSelect={(productId, batchNumber) => {
                // 先设置产品ID
                field.onChange(productId);
                handleProductSelect(productId);

                // 使用 setTimeout 确保产品信息已更新后再设置批次号
                setTimeout(() => {
                  form.setValue(`items.${index}.batchNumber` as unknown as Path<TFieldValues>, batchNumber as unknown as PathValue<TFieldValues, Path<TFieldValues>>);
                  // 调用外部回调
                  onBatchSelect?.(productId, batchNumber);
                }, 0);
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
