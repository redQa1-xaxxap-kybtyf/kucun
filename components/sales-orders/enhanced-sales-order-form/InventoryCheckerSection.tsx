'use client';

import type { FieldArrayWithId } from 'react-hook-form';

import { InventoryChecker } from '@/components/sales-orders/inventory-checker';
import type { Product } from '@/lib/types/product';
import type { SalesOrderCreateFormData as CreateSalesOrderData } from '@/lib/validations/sales-order';

export type InventoryCheckHandler = NonNullable<
  React.ComponentProps<typeof InventoryChecker>['onInventoryCheck']
>;

interface InventoryCheckerSectionProps {
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[];
  products: Product[];
  onInventoryCheck: InventoryCheckHandler;
}

export function InventoryCheckerSection({
  fields,
  products,
  onInventoryCheck,
}: InventoryCheckerSectionProps) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <InventoryChecker
      items={fields.map(item => ({
        productId: item.productId || '',
        quantity: item.quantity ?? 0,
        batchNumber:
          'batchNumber' in item && typeof item.batchNumber === 'string'
            ? item.batchNumber
            : '',
      }))}
      products={products}
      onInventoryCheck={onInventoryCheck}
    />
  );
}
