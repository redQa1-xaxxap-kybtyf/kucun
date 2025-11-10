'use client';

import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

import { ItemsTable } from '@/components/factory-shipments/form-sections/items-table';
import { Card, CardContent } from '@/components/ui/card';
import type { BlurHandlerFactory } from '@/lib/hooks/useFormErrorHandling';
import type { PriceHistoryData } from '@/lib/types/price-history';
import type { Product } from '@/lib/types/product';
import type { CreateFactoryShipmentOrderData } from '@/lib/validations/factory-shipment';

interface ItemListSectionProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
  fieldArray: UseFieldArrayReturn<CreateFactoryShipmentOrderData, 'items'>;
  products: Product[];
  selectedCustomerId: string;
  customerPriceHistoryData?: PriceHistoryData;
  getBlurHandler?: BlurHandlerFactory<CreateFactoryShipmentOrderData>;
}

/**
 * 厂家发货订单产品明细列表
 * 使用表格形式展示和编辑产品明细
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
  const handleAddItem = () => {
    append({
      productId: undefined,
      supplierId: '',
      productCode: '', // 新增：产品编码（必填）
      batchNumber: '',
      quantity: 1,
      unitPrice: 0,
      ownership: 'customer',
      displayName: '', // 改为可选
      specification: '',
      unit: '片',
      piecesPerUnit: undefined,
      ownershipRemarks: '',
      remarks: '',
    });
  };

  // 删除产品
  const handleRemoveItem = (index: number) => {
    remove(index);
  };

  return (
    <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
      <CardContent className="p-8">
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
