'use client';

import * as React from 'react';
import {
  useFieldArray,
  type FieldArrayWithId,
  type UseFieldArrayAppend,
  type UseFieldArrayRemove,
  type UseFieldArrayUpdate,
  type UseFormReturn,
} from 'react-hook-form';

import type { Product } from '@/lib/types/product';
import { getProductAvailableQuantity } from '@/lib/utils/product-inventory';
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

function createEmptyOrderItem(): SalesOrderItemFormData {
  return {
    productId: '',
    productCode: '',
    batchNumber: '',
    colorCode: '',
    productionDate: '',
    specification: '',
    displayUnit: '件',
    displayQuantity: 1,
    quantity: 1,
    unit: '',
    unitPrice: 0,
    piecesPerUnit: undefined,
    remarks: '',
    subtotal: undefined,
    unitCost: undefined,
    costSubtotal: undefined,
    profitAmount: undefined,
    localQuantity: undefined,
    transferQuantity: undefined,
    isManualProduct: false,
    manualProductName: '',
    manualSpecification: '',
    manualWeight: undefined,
    manualUnit: '',
    weightPerPieceKg: undefined,
  };
}

export function useOrderItemsManager(
  form: UseFormReturn<CreateSalesOrderData>,
  products: Product[]
): OrderItemsManagerResult {
  const { fields, append, remove, update } = useFieldArray<
    CreateSalesOrderData,
    'items',
    'id'
  >({
    control: form.control,
    name: 'items',
  });

  const [stockWarnings, setStockWarnings] = React.useState<
    Record<number, string>
  >({});

  const addOrderItem = useAddOrderItem(append);
  const removeOrderItem = useRemoveOrderItem(remove, setStockWarnings);
  const { updateOrderItem, handleProductSelect } = useOrderItemUpdaters(
    fields,
    update,
    products,
    setStockWarnings,
    form
  );
  const handleInventoryCheck = useInventoryCheckHandler(setStockWarnings);
  const totalAmount = useTotalAmount(fields);
  const totalQuantity = useTotalQuantity(fields);

  return {
    fields,
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
  append: UseFieldArrayAppend<CreateSalesOrderData, 'items'>
): () => void {
  return React.useCallback(() => {
    append(createEmptyOrderItem());
  }, [append]);
}

function useRemoveOrderItem(
  remove: UseFieldArrayRemove,
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
    [remove, setStockWarnings]
  );
}

function useOrderItemUpdaters(
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[],
  update: UseFieldArrayUpdate<CreateSalesOrderData, 'items'>,
  products: Product[],
  setStockWarnings: React.Dispatch<
    React.SetStateAction<Record<number, string>>
  >,
  form: UseFormReturn<CreateSalesOrderData>
) {
  const checkProductStock = React.useCallback(
    (productId: string, itemIndex: number, quantityOverride?: number) => {
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

      let requestedQuantity: number;
      if (quantityOverride !== undefined && quantityOverride !== null) {
        const parsed = Number(quantityOverride);
        requestedQuantity = Number.isFinite(parsed) ? parsed : 0;
      } else {
        const items = form.getValues('items') ?? [];
        const formQuantity = items[itemIndex]?.quantity ?? 0;
        const parsed = Number(formQuantity);
        requestedQuantity = Number.isFinite(parsed) ? parsed : 0;
      }
      const currentItem = form.getValues(`items.${itemIndex}`);
      const availableStock =
        getProductAvailableQuantity(product, currentItem?.batchNumber) ?? 0;

      if (requestedQuantity < 0) {
        requestedQuantity = 0;
      }

      setStockWarnings(prev => {
        if (requestedQuantity > availableStock) {
          return {
            ...prev,
            [itemIndex]: `库存不足！可用库存：${availableStock}片`,
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
    [form, products, setStockWarnings]
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

      const nextProductId =
        field === 'productId' && typeof value === 'string'
          ? value
          : typeof updatedItem.productId === 'string'
            ? updatedItem.productId
            : '';

      if (field === 'productId' && !nextProductId) {
        setStockWarnings(prev => {
          if (!prev[index]) {
            return prev;
          }
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }

      if (
        nextProductId &&
        (field === 'productId' ||
          field === 'quantity' ||
          field === 'batchNumber')
      ) {
        const quantityInput =
          field === 'quantity' ? value : updatedItem.quantity;
        const parsed = Number(quantityInput ?? 0);
        const quantityForCheck = Number.isFinite(parsed) ? parsed : 0;

        checkProductStock(nextProductId, index, quantityForCheck);
      }
    },
    [checkProductStock, fields, setStockWarnings, update]
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
  return React.useCallback<InventoryCheckHandler>(
    results => {
      const warnings: Record<number, string> = {};
      results.forEach((result, index) => {
        if (result.severity === 'error' || result.severity === 'warning') {
          warnings[index] = result.message;
        }
      });
      setStockWarnings(warnings);
    },
    [setStockWarnings]
  );
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
