'use client';

import { Trash2 } from 'lucide-react';
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';

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
import type { CreatePurchaseOrderData } from '@/lib/validations/purchase-order';

interface PurchaseOrderItemRowProps {
  form: UseFormReturn<CreatePurchaseOrderData>;
  index: number;
  onRemoveItem: (index: number) => void;
  disableRemove: boolean;
  onProductChange: (index: number, product: Product | null) => void;
  onQuantityChange: (index: number, value: string) => void;
  onUnitPriceChange: (index: number, value: string) => void;
  calculateItemAmount: (index: number) => number;
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
    calculateItemAmount,
  }) => {
    const productId = form.watch(`items.${index}.productId`);
    const productCode = form.watch(`items.${index}.productCode`);
    const supplierId = form.watch(`items.${index}.supplierId`);
    const specification = form.watch(`items.${index}.specification`);

    return (
      <TableRow className="h-12">
        <TableCell className="border-r py-2 text-center text-sm">
          {index + 1}
        </TableCell>

        <ProductSelectorCell
          form={form}
          index={index}
          onProductChange={onProductChange}
        />
        <SupplierSelectorCell form={form} index={index} />
        <TextInputCell
          form={form}
          index={index}
          name={`items.${index}.productCode`}
          placeholder="产品编码"
        />
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
        <UnitPriceCell
          form={form}
          index={index}
          onUnitPriceChange={onUnitPriceChange}
        />
        <TotalAmountCell amount={calculateItemAmount(index)} />
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
}: FormCellProps & {
  onProductChange: (index: number, product: Product | null) => void;
}) {
  return (
    <TableCell className="border-r py-2">
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
}

function TextInputCell({ form, name, placeholder }: TextInputCellProps) {
  return (
    <TableCell className="border-r py-2">
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
                value={field.value || ''}
                onChange={e => onQuantityChange(index, e.target.value)}
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
                value={field.value || ''}
                onChange={e => onUnitPriceChange(index, e.target.value)}
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
