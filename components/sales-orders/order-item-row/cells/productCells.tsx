'use client';

import { BatchSelector } from '@/components/sales-orders/batch-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { TableCell } from '@/components/ui/table';
import type { Product } from '@/lib/types/product';

import type { OrderFormInstance } from '../types';

export function ProductCodeCell({
  form,
  index,
  products,
  onProductChange,
}: {
  form: OrderFormInstance;
  index: number;
  products: Product[];
  onProductChange: (product: Product | null) => void;
}) {
  return (
    <TableCell className="min-w-[200px]">
      <IntelligentProductInput
        form={form}
        index={index}
        products={products}
        onProductChange={onProductChange}
      />
    </TableCell>
  );
}

export function ProductNameCell({
  products,
  productId,
  manualProductName,
}: {
  products: Product[];
  productId?: string;
  manualProductName?: string;
}) {
  const resolvedName =
    productId && products.find(product => product.id === productId)?.name;

  return (
    <TableCell className="min-w-[140px]">
      <div className="flex h-8 items-center text-xs text-gray-700">
        {resolvedName ? (
          <span className="truncate">{resolvedName}</span>
        ) : manualProductName ? (
          <span className="truncate">{manualProductName}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </div>
    </TableCell>
  );
}

export function PiecesPerUnitCell({
  form,
  index,
  isManualProduct,
}: {
  form: OrderFormInstance;
  index: number;
  isManualProduct: boolean;
}) {
  return (
    <TableCell className="min-w-[80px]">
      <FormField
        control={form.control}
        name={`items.${index}.piecesPerUnit`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="number"
                min="1"
                step="1"
                {...field}
                value={field.value ?? ''}
                className="h-8 text-xs"
                placeholder="每件片数"
                disabled={!isManualProduct}
                onChange={event => {
                  const value = event.target.value;
                  field.onChange(
                    value === '' ? undefined : parseInt(value, 10)
                  );
                }}
              />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

export function BatchSelectorCell({
  form,
  index,
  availableBatches,
  disabled,
}: {
  form: OrderFormInstance;
  index: number;
  availableBatches: Array<{ batchNumber: string; quantity: number }>;
  disabled: boolean;
}) {
  return (
    <TableCell className="min-w-[180px]">
      <FormField
        control={form.control}
        name={`items.${index}.batchNumber`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <BatchSelector
                batches={availableBatches}
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

export function ManualInfoCells({
  form,
  index,
  isManualProduct,
}: {
  form: OrderFormInstance;
  index: number;
  isManualProduct: boolean;
}) {
  return (
    <>
      <TableCell className="min-w-[120px]">
        <FormField
          control={form.control}
          name={`items.${index}.manualProductName`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  className="h-8 text-xs"
                  placeholder="手动商品名称"
                  disabled={!isManualProduct}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="min-w-[120px]">
        <FormField
          control={form.control}
          name={`items.${index}.manualSpecification`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  className="h-8 text-xs"
                  placeholder="规格"
                  disabled={!isManualProduct}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="min-w-[100px]">
        <FormField
          control={form.control}
          name={`items.${index}.manualUnit`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  className="h-8 text-xs"
                  placeholder="单位"
                  disabled={!isManualProduct}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </TableCell>
    </>
  );
}
