'use client';

import { ChevronDown, X } from 'lucide-react';
import React from 'react';

import { ProductSearchList } from '@/components/inventory/product-selector/product-search-list';
import { SelectedProductDisplay } from '@/components/inventory/product-selector/selected-product-display';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useProductSelector } from '@/hooks/use-product-selector';
import type { ProductOption } from '@/lib/types/inbound';
import { cn } from '@/lib/utils';

interface ProductSelectorProps {
  value: string;
  onChange: (value: string, product?: ProductOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 产品选择器组件
 * 支持搜索和选择产品，显示产品信息和当前库存
 */
export function ProductSelector({
  value,
  onChange,
  placeholder = '搜索并选择产品...',
  disabled = false,
  className,
}: ProductSelectorProps) {
  const {
    open,
    setOpen,
    selectedProduct,
    products,
    isLoading,
    error,
    handleSearchChange,
    handleClear,
    handleCommandSelect,
  } = useProductSelector(value, onChange);

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <SelectedProductDisplay
              selectedProduct={selectedProduct}
              placeholder={placeholder}
            />
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <ProductSearchList
            products={products}
            selectedProduct={selectedProduct}
            isLoading={isLoading}
            error={error}
            onSearchChange={handleSearchChange}
            onSelect={handleCommandSelect}
          />
        </PopoverContent>
      </Popover>

      {/* 清除按钮 */}
      {selectedProduct && !disabled && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-8 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-muted"
          onClick={handleClear}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
