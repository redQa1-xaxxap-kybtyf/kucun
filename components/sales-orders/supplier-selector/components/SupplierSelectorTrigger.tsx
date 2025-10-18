import { ChevronsUpDown, Search, Truck } from 'lucide-react';
import React, { type ComponentPropsWithoutRef } from 'react';

import { Button } from '@/components/ui/button';
import type { Supplier } from '@/lib/types/supplier';
import { cn } from '@/lib/utils';

interface SupplierSelectorTriggerProps
  extends ComponentPropsWithoutRef<typeof Button> {
  selectedSupplier: Supplier | null;
  placeholder: string;
  isLoading: boolean;
  disabled: boolean;
  className?: string;
  open: boolean;
}

export const SupplierSelectorTrigger = React.forwardRef<
  HTMLButtonElement,
  SupplierSelectorTriggerProps
>(
  (
    {
      selectedSupplier,
      placeholder,
      isLoading,
      disabled,
      className,
      open,
      ...buttonProps
    },
    ref
  ) => (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn('h-12 w-full justify-between', className)}
      disabled={disabled}
      {...buttonProps}
    >
      {selectedSupplier ? (
        <div className="flex items-center gap-2 truncate">
          <Truck className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="flex flex-col items-start truncate">
            <span className="truncate font-medium">
              {selectedSupplier.name}
            </span>
            {selectedSupplier.phone && (
              <span className="text-muted-foreground text-xs">
                {selectedSupplier.phone}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-2">
          <Search className="h-4 w-4" />
          {isLoading ? '加载中...' : placeholder}
        </div>
      )}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  )
);

SupplierSelectorTrigger.displayName = 'SupplierSelectorTrigger';
