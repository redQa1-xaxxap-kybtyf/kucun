'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { TableCell } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

import type { OrderFormInstance } from '../types';

const baseCellClass =
  'border-r last:border-r-0 border-[hsl(var(--color-border-primary))] px-3 py-2 align-middle';

export function AmountCell({ amount }: { amount: number }) {
  return (
    <TableCell className={`${baseCellClass} min-w-[100px]`}>
      <div className="text-xs font-medium text-[hsl(var(--color-text-primary))]">
        ¥{amount.toFixed(2)}
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
    <TableCell className={`${baseCellClass} min-w-[150px]`}>
      <FormField
        control={form.control}
        name={remarksPath}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Textarea
                {...field}
                className="min-h-[32px] resize-none text-xs"
                placeholder="备注"
              />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </TableCell>
  );
}

export function ActionsCell({ onRemove }: { onRemove: () => void }) {
  return (
    <TableCell className="min-w-[80px] px-3 py-2 text-center align-middle">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0"
      >
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </TableCell>
  );
}
