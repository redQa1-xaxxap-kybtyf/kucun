'use client';

import type { UseFormReturn } from 'react-hook-form';

import { SmartProductSearch } from '@/components/sales-orders/smart-product-search';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Product } from '@/lib/types/product';
import type { CreateFactoryShipmentOrderData } from '@/lib/validations/factory-shipment';

interface FactoryShipmentProductInputProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
  index: number;
  products: Product[];
}

export function FactoryShipmentProductInput({
  form,
  index,
  products,
}: FactoryShipmentProductInputProps) {
  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      // 更新产品ID
      form.setValue(`items.${index}.productId`, productId);

      // TODO: 可以设置默认单价（如果产品有默认价格）
      // 暂时不设置默认价格，等待产品模型添加价格字段

      // 清除手动输入的产品信息
      form.setValue(`items.${index}.isManualProduct`, false);
      form.setValue(`items.${index}.manualProductName`, '');
      form.setValue(`items.${index}.manualSpecification`, '');
      form.setValue(`items.${index}.manualWeight`, undefined);
      form.setValue(`items.${index}.manualUnit`, '');
    }
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
        }
      : null,
  }));

  return (
    <FormField
      control={form.control}
      name={`items.${index}.productId`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>选择产品</FormLabel>
          <FormControl>
            <SmartProductSearch
              products={productsWithInventory}
              value={field.value || ''}
              onValueChange={handleProductSelect}
              placeholder="搜索或选择产品..."
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
