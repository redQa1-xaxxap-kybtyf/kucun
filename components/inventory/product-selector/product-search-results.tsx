'use client';

import { Plus } from 'lucide-react';
import React from 'react';

import { InlineLoading } from '@/components/common/loading';
import { ProductOptionItem } from '@/components/inventory/product-selector/product-option-item';
import { Button } from '@/components/ui/button';
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
  onCreateProduct?: () => void;
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

function EmptyState({ onCreateProduct }: { onCreateProduct?: () => void }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 p-4 text-center text-sm">
      <span>未找到相关产品</span>
      {onCreateProduct && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onMouseDown={event => event.preventDefault()}
          onClick={onCreateProduct}
        >
          <Plus className="mr-2 h-4 w-4" />
          快速新增产品
        </Button>
      )}
    </div>
  );
}

export function ProductSearchResults({
  products,
  selectedProduct,
  isLoading,
  onSelect,
  onCreateProduct,
}: ProductSearchResultsProps) {
  return (
    <CommandList>
      {isLoading ? (
        <LoadingState />
      ) : products.length === 0 ? (
        <EmptyState onCreateProduct={onCreateProduct} />
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
