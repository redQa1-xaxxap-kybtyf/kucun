'use client';

import { Trash2 } from 'lucide-react';
import React from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';

import { BatchSelector } from '@/components/batches/batch-selector';
import { ProductSelector } from '@/components/products/product-selector';
import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Product } from '@/lib/types/product';
import { cn } from '@/lib/utils';
import type { CreatePurchaseOrderData } from '@/lib/validations/purchase-order';

interface PurchaseOrderItemRowProps {
  form: UseFormReturn<CreatePurchaseOrderData>;
  index: number;
  onRemoveItem: (index: number) => void;
  disableRemove: boolean;
  onProductChange: (index: number, product: Product | null) => void;
  onQuantityChange: (index: number, value: string) => void;
  onUnitPriceChange: (index: number, value: string) => void;
}

export const PurchaseOrderItemRow = React.memo<PurchaseOrderItemRowProps>(
  ({
    form,
    index,
    onRemoveItem,
    disableRemove,
    onProductChange,
    onQuantityChange,
    onUnitPriceChange,
  }) => {
    const productId = form.watch(`items.${index}.productId`);
    const productCode = form.watch(`items.${index}.productCode`);
    const supplierId = form.watch(`items.${index}.supplierId`);
    const specification = form.watch(`items.${index}.specification`);
    const watchedQuantity = useWatch({
      control: form.control,
      name: `items.${index}.quantity`,
    });
    const watchedUnitPrice = useWatch({
      control: form.control,
      name: `items.${index}.unitPrice`,
    });
    const amount = Number(watchedQuantity || 0) * Number(watchedUnitPrice || 0);

    return (
      <TableRow className="h-10 text-[13px]">
        {/* 冻结列：序号 */}
        <TableCell className="sticky left-0 z-10 border-r bg-white py-2 text-center text-sm">
          {index + 1}
        </TableCell>

        {/* 冻结列：产品名称（选择器） */}
        <ProductSelectorCell
          form={form}
          index={index}
          onProductChange={onProductChange}
          cellClassName="sticky left-[50px] z-10 w-[200px] bg-white"
        />
        {/* 冻结列：产品编码 */}
        <TextInputCell
          form={form}
          index={index}
          name={`items.${index}.productCode`}
          placeholder="产品编码"
          cellClassName="sticky left-[250px] z-10 w-[140px] bg-white"
        />
        <SupplierSelectorCell form={form} index={index} />
        <TextInputCell
          form={form}
          index={index}
          name={`items.${index}.specification`}
          placeholder="规格"
        />
        <BatchSelectorCell
          form={form}
          index={index}
          productId={productId}
          productCode={productCode}
          supplierId={supplierId}
          specification={specification}
        />
        <QuantityCell
          form={form}
          index={index}
          onQuantityChange={onQuantityChange}
        />
        <UnitCell form={form} index={index} />
        <PiecesPerUnitCell form={form} index={index} />
        <UnitPriceCell
          form={form}
          index={index}
          onUnitPriceChange={onUnitPriceChange}
        />
        <TotalAmountCell amount={amount} />
        <TextInputCell
          form={form}
          index={index}
          name={`items.${index}.remarks`}
          placeholder="备注"
        />
        <ActionsCell
          index={index}
          onRemoveItem={onRemoveItem}
          disableRemove={disableRemove}
        />
      </TableRow>
    );
  }
);

PurchaseOrderItemRow.displayName = 'PurchaseOrderItemRow';

interface FormCellProps {
  form: UseFormReturn<CreatePurchaseOrderData>;
  index: number;
}

function ProductSelectorCell({
  form,
  index,
  onProductChange,
  cellClassName,
}: FormCellProps & {
  onProductChange: (index: number, product: Product | null) => void;
  cellClassName?: string;
}) {
  return (
    <TableCell
      className={`border-r py-2 ${cellClassName ?? ''}`}
      data-selector="product"
      data-row-index={index}
    >
      <FormField
        control={form.control}
        name={`items.${index}.productId`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <ProductSelector
                value={field.value}
                onValueChange={field.onChange}
                onProductChange={product => onProductChange(index, product)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

function SupplierSelectorCell({ form, index }: FormCellProps) {
  return (
    <TableCell className="border-r py-2">
      <FormField
        control={form.control}
        name={`items.${index}.supplierId`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <SupplierSelector
                value={field.value}
                onValueChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

interface TextInputCellProps extends FormCellProps {
  name:
    | `items.${number}.productCode`
    | `items.${number}.specification`
    | `items.${number}.remarks`;
  placeholder: string;
  cellClassName?: string;
}

function TextInputCell({
  form,
  name,
  placeholder,
  cellClassName,
}: TextInputCellProps) {
  return (
    <TableCell className={cn('border-r py-2', cellClassName)}>
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input {...field} placeholder={placeholder} className="h-8" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

interface BatchSelectorCellProps extends FormCellProps {
  productId: string | undefined;
  productCode: string | undefined;
  supplierId: string | undefined;
  specification: string | undefined;
}

function BatchSelectorCell({
  form,
  index,
  productId,
  productCode,
  supplierId,
  specification,
}: BatchSelectorCellProps) {
  return (
    <TableCell className="border-r py-2">
      <FormField
        control={form.control}
        name={`items.${index}.batchNumber`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <BatchSelector
                value={field.value}
                onValueChange={field.onChange}
                productId={productId}
                productCode={productCode}
                supplierId={supplierId}
                specification={specification}
                placeholder="选择或输入批次号"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

function QuantityCell({
  form,
  index,
  onQuantityChange,
}: FormCellProps & {
  onQuantityChange: (index: number, value: string) => void;
}) {
  return (
    <TableCell className="border-r py-2">
      <FormField
        control={form.control}
        name={`items.${index}.quantity`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                {...field}
                value={
                  typeof field.value === 'number'
                    ? field.value
                    : (field.value ?? '')
                }
                onChange={e => {
                  const { value } = e.target;
                  if (value === '') {
                    field.onChange(undefined);
                    onQuantityChange(index, '0');
                    return;
                  }
                  const parsed = Number(value);
                  field.onChange(Number.isNaN(parsed) ? undefined : parsed);
                  onQuantityChange(index, value);
                }}
                className="h-8 text-right"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

function UnitCell({ form, index }: FormCellProps) {
  return (
    <TableCell className="border-r py-2">
      <FormField
        control={form.control}
        name={`items.${index}.unit`}
        render={({ field }) => (
          <FormItem>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="piece">件</SelectItem>
                <SelectItem value="sheet">片</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

function UnitPriceCell({
  form,
  index,
  onUnitPriceChange,
}: FormCellProps & {
  onUnitPriceChange: (index: number, value: string) => void;
}) {
  return (
    <TableCell className="border-r py-2">
      <FormField
        control={form.control}
        name={`items.${index}.unitPrice`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                {...field}
                value={
                  typeof field.value === 'number'
                    ? field.value
                    : (field.value ?? '')
                }
                onChange={e => {
                  const { value } = e.target;
                  if (value === '') {
                    field.onChange(undefined);
                    onUnitPriceChange(index, '0');
                    return;
                  }
                  const parsed = Number(value);
                  field.onChange(Number.isNaN(parsed) ? undefined : parsed);
                  onUnitPriceChange(index, value);
                }}
                className="h-8 text-right"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

function PiecesPerUnitCell({ form, index }: FormCellProps) {
  return (
    <TableCell className="border-r py-2">
      <FormField
        control={form.control}
        name={`items.${index}.piecesPerUnit`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="number"
                step="1"
                min="1"
                {...field}
                value={
                  typeof field.value === 'number'
                    ? field.value
                    : (field.value ?? '')
                }
                onChange={e => {
                  const { value } = e.target;
                  if (value === '') {
                    field.onChange(undefined);
                    return;
                  }
                  const parsed = Number(value);
                  field.onChange(Number.isNaN(parsed) ? undefined : parsed);
                }}
                className="h-8 text-right"
                placeholder="—"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

function TotalAmountCell({ amount }: { amount: number }) {
  return (
    <TableCell className="border-r py-2 text-right text-sm font-medium">
      ¥{amount.toFixed(2)}
    </TableCell>
  );
}

function ActionsCell({
  index,
  onRemoveItem,
  disableRemove,
}: {
  index: number;
  onRemoveItem: (index: number) => void;
  disableRemove: boolean;
}) {
  return (
    <TableCell className="py-2 text-center">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onRemoveItem(index)}
        disabled={disableRemove}
        className="h-8 w-8 p-0"
      >
        <Trash2 className="text-destructive h-4 w-4" />
      </Button>
    </TableCell>
  );
}
