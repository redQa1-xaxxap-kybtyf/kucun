'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-media-query';
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
  const isMobile = useIsMobile();
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

  const triggerButton = (
    <BatchSelectorTriggerButton
      open={open}
      selectedBatch={selectedBatch}
      placeholder={placeholder}
      className={className}
      disabled={
        disabled || batches.length === 0 || Boolean(triggerProps?.disabled)
      }
      triggerProps={triggerProps}
    />
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{triggerButton}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="flex h-[70vh] flex-col gap-0 rounded-t-3xl p-0"
          >
            <SheetHeader className="border-b px-4 py-3 text-left">
              <SheetTitle>选择批次</SheetTitle>
              <SheetDescription>
                共 {batches.length} 个可用批次，可按批次号搜索后快速选择。
              </SheetDescription>
            </SheetHeader>
            <BatchSelectorPanel
              batches={batches}
              value={value}
              onSelectBatch={handleBatchSelect}
              listClassName="max-h-none flex-1"
            />
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <BatchSelectorPanel
              batches={batches}
              value={value}
              onSelectBatch={handleBatchSelect}
            />
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}

const BatchSelectorTriggerButton = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button> & {
    open: boolean;
    selectedBatch?: Batch;
    placeholder: string;
    triggerProps?: BatchSelectorTriggerProps;
  }
>(
  (
    {
      open,
      selectedBatch,
      placeholder,
      className,
      disabled,
      triggerProps,
      ...props
    },
    ref
  ) => (
    <Button
      {...props}
      {...triggerProps}
      ref={ref}
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        'h-8 w-full justify-between text-xs font-normal',
        !selectedBatch && 'text-muted-foreground',
        className,
        triggerProps?.className
      )}
      disabled={disabled}
    >
      <span className="truncate">
        {selectedBatch ? selectedBatch.batchNumber : placeholder}
      </span>
      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
    </Button>
  )
);
BatchSelectorTriggerButton.displayName = 'BatchSelectorTriggerButton';

function BatchSelectorPanel({
  batches,
  value,
  onSelectBatch,
  listClassName,
}: {
  batches: Batch[];
  value?: string;
  onSelectBatch: (batchNumber: string) => void;
  listClassName?: string;
}) {
  return (
    <Command className="flex h-full flex-col">
      <CommandInput placeholder="搜索批次号..." className="h-10" />
      <CommandList className={cn('max-h-[320px]', listClassName)}>
        <CommandEmpty>未找到批次</CommandEmpty>
        <CommandGroup>
          {batches.map((batch, idx) => (
            <CommandItem
              key={`${batch.batchNumber}-${idx}`}
              value={batch.batchNumber}
              onSelect={() => onSelectBatch(batch.batchNumber)}
              className="flex flex-col items-start gap-1 p-3"
            >
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      value === batch.batchNumber ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate font-mono text-sm font-medium text-[hsl(var(--color-primary))]">
                    {batch.batchNumber}
                  </span>
                </div>
                <div className="shrink-0 text-sm font-semibold text-green-600">
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
  );
}
