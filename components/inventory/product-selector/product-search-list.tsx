'use client';

import React from 'react';

import { InlineLoading } from '@/components/common/loading';
import { ProductOptionItem } from '@/components/inventory/product-selector/product-option-item';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
    <div className="p-4">
      <InlineLoading text="搜索产品中..." />
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="text-muted-foreground p-4 text-center text-sm">
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
