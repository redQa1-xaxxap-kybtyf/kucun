'use client';

import React from 'react';

import { InlineLoading } from '@/components/common/loading';
import { ProductOptionItem } from '@/components/inventory/product-selector/product-option-item';
import {
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { ProductOption } from '@/lib/types/inbound';

interface ProductSearchResultsProps {
  products: ProductOption[];
  selectedProduct: ProductOption | null;
  isLoading: boolean;
  onSelect: (value: string) => void;
}

function buildProductSearchValue(product: ProductOption) {
  return [
    product.code,
    product.label,
    product.specification,
    product.value,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ');
}

function LoadingState() {
  return (
    <div className="p-4">
      <InlineLoading text="搜索产品中..." />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-muted-foreground p-4 text-center text-sm">
      未找到相关产品
    </div>
  );
}

export function ProductSearchResults({
  products,
  selectedProduct,
  isLoading,
  onSelect,
}: ProductSearchResultsProps) {
  return (
    <CommandList>
      {isLoading ? (
        <LoadingState />
      ) : products.length === 0 ? (
        <EmptyState />
      ) : (
        <CommandGroup>
          {products.map(product => (
            <CommandItem
              key={product.value}
              value={buildProductSearchValue(product)}
              data-product-value={product.value}
              keywords={[
                product.code,
                product.label,
                product.specification,
                product.value,
              ].filter(
                (value): value is string => Boolean(value && value.trim())
              )}
              onSelect={() => onSelect(product.value)}
              className="cursor-pointer"
            >
              <ProductOptionItem
                product={product}
                isSelected={selectedProduct?.value === product.value}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </CommandList>
  );
}
