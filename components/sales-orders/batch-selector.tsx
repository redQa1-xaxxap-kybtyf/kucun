'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';

interface Batch {
  batchNumber: string;
  quantity: number;
  piecesPerUnit?: number | null;
}

type BatchSelectorTriggerProps = React.ComponentPropsWithoutRef<typeof Button> & {
  [key: `data-${string}`]: string | number | undefined;
};

interface BatchSelectorProps {
  batches: Batch[];
  value?: string;
  onValueChange?: (batchNumber: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerProps?: BatchSelectorTriggerProps;
}

function formatBatchStock(batch: Batch): string {
  const piecesPerUnit =
    typeof batch.piecesPerUnit === 'number' && batch.piecesPerUnit > 0
      ? batch.piecesPerUnit
      : 1;

  if (batch.quantity <= 0) {
    return '0片';
  }

  if (piecesPerUnit <= 1) {
    return `${batch.quantity}片`;
  }

  const result = calculatePieceDisplay(batch.quantity, piecesPerUnit);
  return result.displayText;
}

/**
 * 批次选择器组件
 * 用于销售订单中选择产品的具体批次
 */
export function BatchSelector({
  batches,
  value,
  onValueChange,
  placeholder = '选择批次',
  disabled = false,
  className,
  triggerProps,
}: BatchSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const selectedBatch = batches.find(b => b.batchNumber === value);

  const handleBatchSelect = (batchNumber: string) => {
    onValueChange?.(batchNumber);
    setOpen(false);
  };

  // 如果只有一个批次，自动选择并显示
  React.useEffect(() => {
    if (batches.length === 1 && !value) {
      onValueChange?.(batches[0].batchNumber);
    }
  }, [batches, value, onValueChange]);

  if (batches.length === 0) {
    return (
      <div className={cn('text-sm text-gray-500', className)}>暂无可用批次</div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          {...triggerProps}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-8 w-full justify-between text-xs font-normal',
            !selectedBatch && 'text-muted-foreground',
            className,
            triggerProps?.className
          )}
          disabled={disabled || batches.length === 0 || triggerProps?.disabled}
        >
          <span className="truncate">
            {selectedBatch ? selectedBatch.batchNumber : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>未找到批次</CommandEmpty>
            <CommandGroup>
              {batches.map((batch, idx) => (
                <CommandItem
                  key={`${batch.batchNumber}-${idx}`}
                  value={batch.batchNumber}
                  onSelect={() => handleBatchSelect(batch.batchNumber)}
                  className="flex flex-col items-start gap-1 p-3"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          'h-4 w-4',
                          value === batch.batchNumber
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <span className="font-mono text-sm font-medium text-[hsl(var(--color-primary))]">
                        {batch.batchNumber}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-green-600">
                      {formatBatchStock(batch)}
                    </div>
                  </div>
                  {batch.piecesPerUnit && batch.piecesPerUnit > 1 && (
                    <div className="ml-6 text-xs text-gray-500">
                      每件 {batch.piecesPerUnit} 片
                    </div>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
