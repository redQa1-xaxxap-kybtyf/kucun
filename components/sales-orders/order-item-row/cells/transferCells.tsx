'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { TableCell } from '@/components/ui/table';
import type { TransferFulfillmentMode } from '@/lib/types/sales-order';

import type { OrderFormInstance } from '../types';

export function TransferInfoCell({
  form,
  index,
  transferMode,
  localQuantityDisplay,
  transferQuantityDisplay,
  formatQuantity,
}: {
  form: OrderFormInstance;
  index: number;
  transferMode?: TransferFulfillmentMode;
  localQuantityDisplay: number;
  transferQuantityDisplay: number;
  formatQuantity: (value: number) => string;
}) {
  const localQuantityPath = `items.${index}.localQuantity` as const;
  if (transferMode === 'MIXED') {
    return (
      <TableCell className="min-w-[160px]">
        <div className="space-y-1">
          <FormField
            control={form.control}
            name={localQuantityPath}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    value={field.value ?? ''}
                    className="h-8 text-xs"
                    placeholder="本地数量"
                    onChange={event => {
                      const value = event.target.value;
                      field.onChange(
                        value === '' ? undefined : parseFloat(value)
                      );
                    }}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
            本地发货：{formatQuantity(localQuantityDisplay)} 片
          </div>
          <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
            调货数量：{formatQuantity(transferQuantityDisplay)} 片
          </div>
        </div>
      </TableCell>
    );
  }

  return (
    <TableCell className="min-w-[160px]">
      <div className="text-xs text-[hsl(var(--color-text-tertiary))]">
        全部由供应商调货（{formatQuantity(transferQuantityDisplay)} 片）
      </div>
    </TableCell>
  );
}
