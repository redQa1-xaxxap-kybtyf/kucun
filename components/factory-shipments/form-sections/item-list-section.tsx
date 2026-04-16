'use client';

import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

import { ItemsTable } from '@/components/factory-shipments/form-sections/items-table';
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
    <section className="px-4 py-3 sm:px-5 lg:px-5">
      <div className="mb-3 border-b border-[hsl(var(--color-border-secondary))] pb-2">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
              发货明细
            </h3>
            <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
              先录产品，再补批次和价格。
            </p>
          </div>
        </div>
      </div>
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
    </section>
  );
}
