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
import { getInventoryBatchAvailableQuantity } from '@/lib/utils/product-inventory';
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

      // 清除手动输入的产品信息
      form.setValue(`items.${index}.isManualProduct`, false);
      form.setValue(`items.${index}.manualProductName`, '');
      form.setValue(`items.${index}.manualSpecification`, '');
      form.setValue(`items.${index}.manualWeight`, undefined);
      form.setValue(`items.${index}.manualUnit`, '');
    }
  };

  // 转换产品数据格式以匹配 SmartProductSearch 的类型要求
  const productsWithInventory = products.map(p => {
    const batchSpecs = p.batchSpecs ?? [];
    const batchSpecMap = new Map(
      batchSpecs.map(spec => [spec.batchNumber, spec])
    );

    const inventoryBatches = p.inventory?.batches
      ? p.inventory.batches.map(b => {
          const spec = batchSpecMap.get(b.batchNumber);
          const normalizedPieces =
            typeof b.piecesPerUnit === 'number' && b.piecesPerUnit > 0
              ? b.piecesPerUnit
              : spec?.piecesPerUnit && spec.piecesPerUnit > 0
                ? spec.piecesPerUnit
                : undefined;
          const batchWeight = (b as { weight?: number }).weight;
          const normalizedWeight =
            typeof batchWeight === 'number' && batchWeight > 0
              ? batchWeight
              : spec?.weight && spec.weight > 0
                ? spec.weight
                : undefined;

          return {
            batchNumber: b.batchNumber,
            quantity: b.quantity,
            reservedQuantity: b.reservedQuantity,
            availableQuantity: getInventoryBatchAvailableQuantity(b),
            piecesPerUnit: normalizedPieces,
            weight: normalizedWeight,
          };
        })
      : undefined;

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      specification: p.specification,
      unit: p.unit,
      piecesPerUnit: p.piecesPerUnit,
      weight: p.weight,
      batchSpecs: batchSpecs.length > 0 ? batchSpecs : undefined,
      inventory: p.inventory
        ? {
            totalInventory: p.inventory.totalQuantity || 0,
            availableInventory: p.inventory.availableQuantity || 0,
            reservedInventory: p.inventory.reservedQuantity || 0,
            batches: inventoryBatches,
          }
        : null,
    };
  });

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
