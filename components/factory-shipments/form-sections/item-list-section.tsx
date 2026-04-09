'use client';

import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

import { ItemsTable } from '@/components/factory-shipments/form-sections/items-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BlurHandlerFactory } from '@/lib/hooks/useFormErrorHandling';
import type { PriceHistoryData } from '@/lib/types/price-history';
import type { Product } from '@/lib/types/product';
import { createFactoryShipmentDraftItem } from '@/lib/utils/order-form-defaults';
import type { FactoryShipmentOrderFormData } from '@/lib/validations/factory-shipment';

interface ItemListSectionProps {
  form: UseFormReturn<FactoryShipmentOrderFormData, any, any>;
  fieldArray: UseFieldArrayReturn<FactoryShipmentOrderFormData, 'items', any>;
  products: Product[];
  selectedCustomerId: string;
  customerPriceHistoryData?: PriceHistoryData;
  getBlurHandler?: BlurHandlerFactory<FactoryShipmentOrderFormData>;
}

/**
 * 厂家发货订单产品明细列表
 * 使用分行录单形式展示和编辑产品明细
 */
export function ItemListSection({
  form,
  fieldArray,
  products,
  selectedCustomerId,
  customerPriceHistoryData,
  getBlurHandler,
}: ItemListSectionProps) {
  const { fields, append, remove } = fieldArray;

  // 添加产品
  const handleAddItem = (preferredSupplierId?: string) => {
    append(
      createFactoryShipmentDraftItem({
        items: form.getValues('items'),
        preferredSupplierId,
      })
    );
  };

  // 删除产品
  const handleRemoveItem = (index: number) => {
    remove(index);
  };

  return (
    <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <CardTitle className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
          产品明细
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 lg:p-6 xl:p-8">
        <ItemsTable
          form={form}
          products={products}
          selectedCustomerId={selectedCustomerId}
          customerPriceHistoryData={customerPriceHistoryData}
          fields={fields}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          getBlurHandler={getBlurHandler}
        />
      </CardContent>
    </Card>
  );
}
