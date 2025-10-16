'use client';

import { Package, Plus } from 'lucide-react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

import { ItemForm } from '@/components/factory-shipments/form-sections/item-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PriceHistoryData } from '@/lib/types/price-history';
import type { Product } from '@/lib/types/product';
import type { CreateFactoryShipmentOrderData } from '@/lib/validations/factory-shipment';

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
      ownership: 'customer',
      displayName: '',
      specification: '',
      unit: '件',
      ownershipRemarks: '',
      remarks: '',
    });
  };

  // 删除商品
  const handleRemoveItem = (index: number) => {
    remove(index);
  };

  return (
    <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-primary))]">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-sm">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <span className="font-semibold text-[hsl(var(--color-text-primary))]">
                商品明细
              </span>
              <p className="text-xs font-normal text-[hsl(var(--color-text-secondary))]">
                共 {fields.length} 个商品
              </p>
            </div>
          </CardTitle>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleAddItem}
            className="shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加商品
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-5">
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
