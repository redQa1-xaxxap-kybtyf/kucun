'use client';

import React from 'react';

import { ProductOptionItem } from '@/components/inventory/product-selector/product-option-item';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProductOption } from '@/lib/types/inbound';

interface ProductSearchListProps {
  products: ProductOption[];
  selectedProduct: ProductOption | null;
  isLoading: boolean;
  error: Error | null;
  onSearchChange: (query: string) => void;
  onSelect: (value: string) => void;
}

function LoadingState() {
  return (
    <div className="p-2">
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="p-4 text-center text-sm text-muted-foreground">
      搜索失败: {error.message}
    </div>
  );
}

export function ProductSearchList({
  products,
  selectedProduct,
  isLoading,
  error,
  onSearchChange,
  onSelect,
}: ProductSearchListProps) {
  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <Command>
      <CommandInput
        placeholder="搜索产品名称或编码..."
        onValueChange={onSearchChange}
      />
      <CommandList>
        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            <CommandEmpty>未找到相关产品</CommandEmpty>
            <CommandGroup>
              {products.map(product => (
                <CommandItem
                  key={product.value}
                  value={`${product.code}-${product.value}`}
                  onSelect={onSelect}
                  className="cursor-pointer"
                >
                  <ProductOptionItem
                    product={product}
                    isSelected={selectedProduct?.value === product.value}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}
