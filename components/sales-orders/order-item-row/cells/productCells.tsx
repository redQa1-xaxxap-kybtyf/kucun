'use client';

import { useWatch } from 'react-hook-form';

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
import { requiresProductBatchSelection } from '@/lib/utils/product-inventory';

import type { OrderFormInstance } from '../types';

const baseCellClass =
  'border-r last:border-r-0 border-[hsl(var(--color-border-primary))] px-3 py-2 align-middle';

export function ProductCodeCell({
  form,
  index,
  products,
  onProductChange,
  orderType,
  isManualProduct,
}: {
  form: OrderFormInstance;
  index: number;
  products: Product[];
  onProductChange: (product: Product | null) => void;
  orderType: 'NORMAL' | 'TRANSFER';
  isManualProduct: boolean;
}) {
  const productCodePath = `items.${index}.productCode` as const;

  return (
    <TableCell className={`${baseCellClass} min-w-[200px]`}>
      {isManualProduct ? (
        <FormField
          control={form.control}
          name={productCodePath}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  className="h-8 font-mono text-xs"
                  placeholder="产品编码"
                  onChange={event => {
                    const value = event.target.value;
                    field.onChange(value === '' ? undefined : value.trim());
                  }}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      ) : (
        <IntelligentProductInput
          form={form}
          index={index}
          products={products}
          onProductChange={onProductChange}
          orderType={orderType}
        />
      )}
    </TableCell>
  );
}

export function ProductNameCell({
  form,
  index,
  products,
  productId,
  isManualProduct,
  orderType: _orderType,
}: {
  form: OrderFormInstance;
  index: number;
  products: Product[];
  productId?: string;
  isManualProduct: boolean;
  orderType: 'NORMAL' | 'TRANSFER';
}) {
  const manualNamePath = `items.${index}.manualProductName` as const;
  const resolvedName =
    productId && products.find(product => product.id === productId)?.name;
  const requireManualName = false;

  return (
    <TableCell className={`${baseCellClass} min-w-[140px]`}>
      {isManualProduct ? (
        <FormField
          control={form.control}
          name={manualNamePath}
          rules={
            requireManualName
              ? {
                  validate: value => {
                    const trimmed = (value ?? '').toString().trim();
                    return trimmed.length > 0 || '请输入产品名称';
                  },
                }
              : undefined
          }
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  className="h-8 text-xs"
                  placeholder={
                    requireManualName ? '产品名称' : '产品名称（可选）'
                  }
                  onChange={event => {
                    const next = event.target.value;
                    field.onChange(next === '' ? undefined : next);
                  }}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      ) : (
        <div className="flex h-8 items-center text-xs text-[hsl(var(--color-text-primary))]">
          {resolvedName ? (
            <span className="truncate">{resolvedName}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      )}
    </TableCell>
  );
}

export function PiecesPerUnitCell({
  form,
  index,
  isManualProduct,
  resolvedProduct,
}: {
  form: OrderFormInstance;
  index: number;
  isManualProduct: boolean;
  resolvedProduct: Product | null;
}) {
  const piecesPerUnitPath = `items.${index}.piecesPerUnit` as const;
  return (
    <TableCell className={`${baseCellClass} min-w-[90px]`}>
      <FormField
        control={form.control}
        name={piecesPerUnitPath}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="number"
                min="1"
                step="1"
                {...field}
                value={
                  field.value ??
                  (isManualProduct
                    ? ''
                    : (resolvedProduct?.piecesPerUnit ?? ''))
                }
                className="h-8 text-xs"
                placeholder="装箱数"
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
  resolvedProduct,
  isManualProduct,
  disabled,
}: {
  form: OrderFormInstance;
  index: number;
  availableBatches: Array<{
    batchNumber: string;
    quantity: number;
    piecesPerUnit?: number;
  }>;
  resolvedProduct: Product | null;
  isManualProduct: boolean;
  disabled: boolean;
}) {
  const batchNumberPath = `items.${index}.batchNumber` as const;
  return (
    <TableCell className={`${baseCellClass} min-w-[180px]`}>
      <FormField
        control={form.control}
        name={batchNumberPath}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <BatchSelector
                batches={availableBatches}
                value={field.value}
                onValueChange={batchNumber => {
                  field.onChange(batchNumber);

                  if (!isManualProduct) {
                    const matched = availableBatches.find(
                      batch => batch.batchNumber === batchNumber
                    );
                    const fallback =
                      typeof resolvedProduct?.piecesPerUnit === 'number' &&
                      resolvedProduct.piecesPerUnit > 0
                        ? resolvedProduct.piecesPerUnit
                        : undefined;
                    const nextPieces =
                      matched &&
                      matched.piecesPerUnit &&
                      matched.piecesPerUnit > 0
                        ? matched.piecesPerUnit
                        : fallback;

                    form.setValue(
                      `items.${index}.piecesPerUnit` as const,
                      nextPieces,
                      {
                        shouldDirty: false,
                        shouldValidate: false,
                      }
                    );
                  }
                }}
                disabled={disabled}
                triggerProps={{
                  'data-sales-order-focus-target': 'batch',
                }}
              />
            </FormControl>
            <FormMessage className="text-xs" />
            {!isManualProduct &&
              requiresProductBatchSelection(resolvedProduct, field.value) && (
                <p className="text-[11px] text-amber-600">
                  存在多个可用批次，请先选择批次
                </p>
              )}
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
  const manualSpecPath = `items.${index}.manualSpecification` as const;
  const specificationPath = `items.${index}.specification` as const;

  const specificationValue =
    useWatch({
      control: form.control,
      name: specificationPath,
    }) ?? '';

  return (
    <TableCell className={`${baseCellClass} min-w-[150px]`}>
      {isManualProduct ? (
        <FormField
          control={form.control}
          name={manualSpecPath}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  className="h-8 text-xs"
                  placeholder="规格"
                  onChange={event => {
                    const value = event.target.value;
                    field.onChange(value === '' ? undefined : value);
                  }}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      ) : (
        <div className="flex h-8 items-center text-xs text-[hsl(var(--color-text-primary))]">
          <span className="truncate">
            {specificationValue ? specificationValue : '—'}
          </span>
        </div>
      )}
    </TableCell>
  );
}
