'use client';

import * as React from 'react';
import {
  useFieldArray,
  type FieldArrayWithId,
  type UseFormReturn,
} from 'react-hook-form';

import type { Product } from '@/lib/types/product';
import type { SalesOrderCreateFormData as CreateSalesOrderData } from '@/lib/validations/sales-order';
import type { SalesOrderItemFormData } from '@/lib/validations/sales-order/schemas';

import type { InventoryCheckHandler } from '../InventoryCheckerSection';

export interface OrderItemsManagerResult {
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[];
  stockWarnings: Record<number, string>;
  addOrderItem: () => void;
  removeOrderItem: (index: number) => void;
  updateOrderItem: <Key extends keyof SalesOrderItemFormData>(
    index: number,
    field: Key,
    value: SalesOrderItemFormData[Key]
  ) => void;
  handleProductSelect: (productId: string, index: number) => void;
  handleInventoryCheck: InventoryCheckHandler;
  totalAmount: number;
  totalQuantity: number;
}

export function useOrderItemsManager(
  form: UseFormReturn<CreateSalesOrderData>,
  products: Product[]
): OrderItemsManagerResult {
  const fieldArray = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const [stockWarnings, setStockWarnings] = React.useState<
    Record<number, string>
  >({});

  const addOrderItem = useAddOrderItem(fieldArray.append);
  const removeOrderItem = useRemoveOrderItem(
    fieldArray.remove,
    setStockWarnings
  );
  const { updateOrderItem, handleProductSelect } = useOrderItemUpdaters(
    fieldArray.fields,
    fieldArray.update,
    products,
    setStockWarnings
  );
  const handleInventoryCheck = useInventoryCheckHandler(setStockWarnings);
  const totalAmount = useTotalAmount(fieldArray.fields);
  const totalQuantity = useTotalQuantity(fieldArray.fields);

  return {
    fields: fieldArray.fields,
    stockWarnings,
    addOrderItem,
    removeOrderItem,
    updateOrderItem,
    handleProductSelect,
    handleInventoryCheck,
    totalAmount,
    totalQuantity,
  };
}

function useAddOrderItem(
  append: ReturnType<typeof useFieldArray>['append']
): () => void {
  return React.useCallback(() => {
    append({
      productId: '',
      quantity: 1,
      unitPrice: 0,
      displayUnit: '件',
      displayQuantity: 1,
    } as unknown as SalesOrderItemFormData);
  }, [append]);
}

function useRemoveOrderItem(
  remove: ReturnType<typeof useFieldArray>['remove'],
  setStockWarnings: React.Dispatch<React.SetStateAction<Record<number, string>>>
) {
  return React.useCallback(
    (index: number) => {
      remove(index);
      setStockWarnings(prev => {
        if (Object.keys(prev).length === 0) {
          return prev;
        }
        const next: Record<number, string> = {};
        Object.entries(prev).forEach(([key, value]) => {
          const currentIndex = Number(key);
          if (currentIndex < index) {
            next[currentIndex] = value;
          } else if (currentIndex > index) {
            next[currentIndex - 1] = value;
          }
        });
        return next;
      });
    },
    [remove]
  );
}

function useOrderItemUpdaters(
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[],
  update: ReturnType<typeof useFieldArray>['update'],
  products: Product[],
  setStockWarnings: React.Dispatch<React.SetStateAction<Record<number, string>>>
) {
  const checkProductStock = React.useCallback(
    (productId: string, itemIndex: number) => {
      const product = products.find(current => current.id === productId);
      if (!product?.inventory) {
        setStockWarnings(prev => {
          if (!prev[itemIndex]) {
            return prev;
          }
          const next = { ...prev };
          delete next[itemIndex];
          return next;
        });
        return;
      }

      const availableStock = product.inventory.availableQuantity ?? 0;
      const requestedQuantity = fields[itemIndex]?.quantity ?? 0;

      setStockWarnings(prev => {
        if (requestedQuantity > availableStock) {
          return {
            ...prev,
            [itemIndex]: `库存不足！可用库存：${availableStock}${product.unit}`,
          };
        }
        if (!prev[itemIndex]) {
          return prev;
        }
        const next = { ...prev };
        delete next[itemIndex];
        return next;
      });
    },
    [fields, products, setStockWarnings]
  );

  const updateOrderItem = React.useCallback(
    <Key extends keyof SalesOrderItemFormData>(
      index: number,
      field: Key,
      value: SalesOrderItemFormData[Key]
    ) => {
      const currentItem = fields[index];
      if (!currentItem) {
        return;
      }

      const updatedItem: SalesOrderItemFormData & { id?: string } = {
        ...currentItem,
        [field]: value,
      };

      if (field === 'quantity' || field === 'unitPrice') {
        const quantity =
          field === 'quantity'
            ? Number(value) || 0
            : Number(currentItem.quantity) || 0;
        const unitPrice =
          field === 'unitPrice'
            ? Number(value) || 0
            : Number(currentItem.unitPrice) || 0;
        updatedItem.subtotal = quantity * unitPrice;
      }

      update(index, updatedItem as SalesOrderItemFormData);

      if (field === 'productId' && typeof value === 'string' && value) {
        checkProductStock(value, index);
      }
    },
    [checkProductStock, fields, update]
  );

  const handleProductSelect = React.useCallback(
    (productId: string, itemIndex: number) => {
      updateOrderItem(itemIndex, 'productId', productId);
    },
    [updateOrderItem]
  );

  return { updateOrderItem, handleProductSelect };
}

function useInventoryCheckHandler(
  setStockWarnings: React.Dispatch<React.SetStateAction<Record<number, string>>>
): InventoryCheckHandler {
  return React.useCallback<InventoryCheckHandler>(results => {
    const warnings: Record<number, string> = {};
    results.forEach((result, index) => {
      if (result.severity === 'error' || result.severity === 'warning') {
        warnings[index] = result.message;
      }
    });
    setStockWarnings(warnings);
  }, []);
}

function useTotalAmount(
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[]
): number {
  return React.useMemo(
    () =>
      fields.reduce(
        (sum, item) => sum + (item.quantity ?? 0) * (item.unitPrice ?? 0),
        0
      ),
    [fields]
  );
}

function useTotalQuantity(
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[]
): number {
  return React.useMemo(
    () => fields.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
    [fields]
  );
}
