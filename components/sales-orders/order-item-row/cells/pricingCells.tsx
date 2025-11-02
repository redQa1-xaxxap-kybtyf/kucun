'use client';

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
import { TableCell } from '@/components/ui/table';
import type { Product } from '@/lib/types/product';

import type { OrderFormInstance } from '../types';

const baseCellClass =
  'border-r last:border-r-0 border-[hsl(var(--color-border-primary))] px-3 py-2 align-middle';

export function UnitAndQuantityCells({
  form,
  index,
  resolvedProduct,
  isManualProduct,
}: {
  form: OrderFormInstance;
  index: number;
  resolvedProduct: Product | null;
  isManualProduct: boolean;
}) {
  return (
    <>
      <UnitSelectCell
        form={form}
        index={index}
        resolvedProduct={resolvedProduct}
        isManualProduct={isManualProduct}
      />
      <QuantityInputCell form={form} index={index} />
    </>
  );
}

function UnitSelectCell({
  form,
  index,
  resolvedProduct,
  isManualProduct,
}: {
  form: OrderFormInstance;
  index: number;
  resolvedProduct: Product | null;
  isManualProduct: boolean;
}) {
  const unitPricePath = `items.${index}.unitPrice` as const;
  const piecesPerUnitPath = `items.${index}.piecesPerUnit` as const;
  const displayUnitPath = `items.${index}.displayUnit` as const;
  return (
    <TableCell className={`${baseCellClass} min-w-[120px]`}>
      <FormField
        control={form.control}
        name={displayUnitPath}
        render={({ field }) => (
          <FormItem>
            <Select
              value={field.value}
              onValueChange={newUnit => {
                const oldUnit = field.value;
                const currentPrice = form.getValues(unitPricePath);
                const piecesPerUnit = form.getValues(piecesPerUnitPath);

                if (oldUnit !== newUnit && currentPrice && piecesPerUnit) {
                  let newPrice = currentPrice;
                  if (oldUnit === '片' && newUnit === '件') {
                    newPrice = currentPrice * piecesPerUnit;
                  } else if (oldUnit === '件' && newUnit === '片') {
                    newPrice = currentPrice / piecesPerUnit;
                  }

                  form.setValue(
                    unitPricePath,
                    Math.round(newPrice * 100) / 100,
                    { shouldDirty: true, shouldValidate: false }
                  );
                }

                field.onChange(newUnit);
              }}
            >
              <FormControl>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="片">片</SelectItem>
                <SelectItem
                  value="件"
                  disabled={!resolvedProduct?.piecesPerUnit && !isManualProduct}
                >
                  件
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

function QuantityInputCell({
  form,
  index,
}: {
  form: OrderFormInstance;
  index: number;
}) {
  const displayQuantityPath = `items.${index}.displayQuantity` as const;
  return (
    <TableCell className={`${baseCellClass} min-w-[100px]`}>
      <FormField
        control={form.control}
        name={displayQuantityPath}
        rules={{
          validate: value => {
            if (value === undefined || value === null) {
              return '数量不能为空';
            }
            const numeric = Number(value);
            if (Number.isNaN(numeric) || numeric <= 0) {
              return '数量必须大于 0';
            }
            return true;
          },
        }}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="text"
                inputMode="decimal"
                value={field.value ?? ''}
                className="h-8 text-xs"
                placeholder="数量"
                onChange={event => {
                  const inputValue = event.target.value;
                  // 允许输入数字、小数点、空字符串
                  if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
                    // 允许空值，不立即转换，让用户可以删除内容
                    field.onChange(inputValue === '' ? '' : inputValue);
                  }
                }}
                onBlur={event => {
                  const inputValue = event.target.value;
                  // 失焦时处理空值：如果为空或只有小数点，设置为默认值1
                  if (!inputValue || inputValue === '.') {
                    field.onChange(1);
                  } else {
                    const parsed = parseFloat(inputValue);
                    if (!Number.isNaN(parsed)) {
                      field.onChange(parsed);
                    } else {
                      // 如果解析失败，恢复为默认值1
                      field.onChange(1);
                    }
                  }
                  field.onBlur();
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

export function UnitPriceCell({
  form,
  index,
}: {
  form: OrderFormInstance;
  index: number;
}) {
  const unitPricePath = `items.${index}.unitPrice` as const;
  return (
    <TableCell className={`${baseCellClass} min-w-[100px]`}>
      <FormField
        control={form.control}
        name={unitPricePath}
        rules={{
          required: '单价不能为空',
          validate: value => {
            const numeric = Number(value);
            return numeric > 0 || '单价必须大于 0';
          },
        }}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="text"
                inputMode="decimal"
                {...field}
                value={
                  field.value === undefined || Number.isNaN(field.value)
                    ? ''
                    : field.value
                }
                className="h-8 text-xs"
                placeholder="单价"
                onChange={event => {
                  const value = event.target.value;
                  // 允许输入数字、小数点、空字符串
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    // 允许空值，不立即转换，让用户可以删除内容
                    field.onChange(value === '' ? '' : value);
                  }
                }}
                onFocus={event => {
                  // 聚焦时自动选中所有内容，方便用户直接输入新价格
                  event.target.select();
                }}
                onBlur={event => {
                  const value = event.target.value;
                  // 失焦时处理空值：如果为空或只有小数点，设置为0
                  if (!value || value === '.') {
                    field.onChange(0);
                  } else {
                    const parsed = Number.parseFloat(value);
                    if (!Number.isNaN(parsed)) {
                      field.onChange(parsed);
                    } else {
                      // 如果解析失败，恢复为0
                      field.onChange(0);
                    }
                  }
                  field.onBlur();
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

export function UnitCostCell({
  form,
  index,
}: {
  form: OrderFormInstance;
  index: number;
}) {
  const unitCostPath = `items.${index}.unitCost` as const;
  return (
    <TableCell className={`${baseCellClass} min-w-[120px]`}>
      <FormField
        control={form.control}
        name={unitCostPath}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...field}
                value={
                  field.value === undefined || Number.isNaN(field.value)
                    ? ''
                    : field.value
                }
                className="h-8 text-xs"
                placeholder="成本单价"
                onChange={event => {
                  const value = event.target.value;
                  field.onChange(
                    value === '' ? undefined : Number.parseFloat(value)
                  );
                }}
                onFocus={event => {
                  // 聚焦时自动选中所有内容，方便用户直接输入新成本
                  event.target.select();
                }}
                onBlur={field.onBlur}
              />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </TableCell>
  );
}
