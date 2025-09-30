'use client';

import { Package, Plus } from 'lucide-react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

import { ItemForm } from '@/components/factory-shipments/form-sections/item-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CreateFactoryShipmentOrderData } from '@/lib/schemas/factory-shipment';
import type { Product } from '@/lib/types/product';

import type { PriceHistoryData } from '@/lib/types/price-history';

interface ItemListSectionProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
  fieldArray: UseFieldArrayReturn<CreateFactoryShipmentOrderData, 'items'>;
  products: Product[];
  selectedCustomerId: string;
  customerPriceHistoryData?: PriceHistoryData;
}

/**
 * 厂家发货订单商品明细列表
 * 包含商品列表和添加商品按钮
 */
export function ItemListSection({
  form,
  fieldArray,
  products,
  selectedCustomerId,
  customerPriceHistoryData,
}: ItemListSectionProps) {
  const { fields, append, remove } = fieldArray;

  // 添加商品
  const handleAddItem = () => {
    append({
      productId: '',
      supplierId: '',
      quantity: 1,
      unitPrice: 0,
      displayName: '',
      specification: '',
      unit: '件',
      remarks: '',
    });
  };

  // 删除商品
  const handleRemoveItem = (index: number) => {
    remove(index);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            商品明细
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
          >
            <Plus className="mr-2 h-4 w-4" />
            添加商品
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fields.map((field, index) => (
            <ItemForm
              key={field.id}
              form={form}
              index={index}
              products={products}
              canRemove={fields.length > 1}
              onRemove={() => handleRemoveItem(index)}
              selectedCustomerId={selectedCustomerId}
              customerPriceHistoryData={customerPriceHistoryData}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
