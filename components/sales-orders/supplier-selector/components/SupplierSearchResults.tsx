import { Check } from 'lucide-react';

import { CommandGroup, CommandItem } from '@/components/ui/command';
import type { Supplier } from '@/lib/types/supplier';
import { cn } from '@/lib/utils';

interface SupplierSearchResultsProps {
  suppliers: Supplier[];
  selectedValue?: string;
  onSelect: (supplierId: string) => void;
}

export function SupplierSearchResults({
  suppliers,
  selectedValue,
  onSelect,
}: SupplierSearchResultsProps) {
  return (
    <CommandGroup>
      {suppliers.map(supplier => {
        const isSelected = selectedValue === supplier.id;
        return (
          <CommandItem
            key={supplier.id}
            value={`${supplier.name ?? ''} ${supplier.phone ?? ''}`.trim()}
            onSelect={() => onSelect(supplier.id)}
            className="flex items-start gap-3 p-3"
          >
            <Check
              className={cn(
                'h-4 w-4',
                isSelected ? 'opacity-100' : 'opacity-0'
              )}
            />
            <div className="flex-1 space-y-1">
              <div className="font-medium">{supplier.name}</div>
              {supplier.phone && (
                <div className="text-muted-foreground text-xs">
                  {supplier.phone}
                </div>
              )}
              {supplier.address && (
                <div className="text-muted-foreground text-xs">
                  {supplier.address}
                </div>
              )}
            </div>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}
