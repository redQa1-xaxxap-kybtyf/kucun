'use client';

import React from 'react';

import { ProductSearchResults } from '@/components/inventory/product-selector/product-search-results';
import {
  Command,
  CommandInput,
} from '@/components/ui/command';
import type { ProductOption } from '@/lib/types/inbound';

interface ProductSearchListProps {
  products: ProductOption[];
  searchValue: string;
  selectedProduct: ProductOption | null;
  isLoading: boolean;
  error: Error | null;
  onSearchChange: (query: string) => void;
  onSelect: (value: string) => void;
  onCreateProduct?: () => void;
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
  searchValue,
  selectedProduct,
  isLoading,
  error,
  onSearchChange,
  onSelect,
  onCreateProduct,
}: ProductSearchListProps) {
  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <Command filter={() => 1}>
      <CommandInput
        value={searchValue}
        placeholder="搜索产品名称或编码..."
        onValueChange={onSearchChange}
      />
      <ProductSearchResults
        products={products}
        selectedProduct={selectedProduct}
        isLoading={isLoading}
        onSelect={onSelect}
        onCreateProduct={onCreateProduct}
      />
    </Command>
  );
}
