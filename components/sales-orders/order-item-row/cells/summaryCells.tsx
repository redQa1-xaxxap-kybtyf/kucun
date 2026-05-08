'use client';

import { Copy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { TableCell } from '@/components/ui/table';

import type { OrderFormInstance } from '../types';

const baseCellClass =
  'border-r last:border-r-0 border-[hsl(var(--color-border-primary))] px-3 py-2 align-middle';

export function AmountCell({ amount }: { amount: number }) {
  return (
    <TableCell className={`${baseCellClass} min-w-[92px] text-right`}>
      <div className="text-xs font-medium tabular-nums text-[hsl(var(--color-text-primary))]">
        ￥{amount.toFixed(2)}
      </div>
    </TableCell>
  );
}

export function RemarksCell({
  form,
  index,
}: {
  form: OrderFormInstance;
  index: number;
}) {
  const remarksPath = `items.${index}.remarks` as const;
  return (
    <TableCell className={`${baseCellClass} min-w-[128px]`}>
      <FormField
        control={form.control}
        name={remarksPath}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                className="h-8 text-xs"
                placeholder="备注"
                maxLength={200}
              />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

export function ActionsCell({
  onRemove,
  onDuplicate,
}: {
  onRemove: () => void;
  onDuplicate?: () => void;
}) {
  return (
    <TableCell className="min-w-[80px] px-2 py-2 text-center align-middle">
      <div className="flex items-center justify-center gap-0.5">
        {onDuplicate ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDuplicate}
            className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="复制本行"
            title="复制本行"
          >
            <Copy className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0"
          aria-label="删除本行"
          title="删除本行"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </TableCell>
  );
}
