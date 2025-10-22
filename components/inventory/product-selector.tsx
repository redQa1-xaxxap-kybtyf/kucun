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

interface ProductSelectorProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'value' | 'onChange'
  > {
  value: string;
  onChange: (value: string, product?: ProductOption) => void;
  placeholder?: string;
  containerClassName?: string;
  error?: boolean;
}

/**
 * 产品选择器组件
 * 支持搜索和选择产品，显示产品信息和当前库存
 */
export const ProductSelector = React.forwardRef<
  HTMLButtonElement,
  ProductSelectorProps
>(
  (
    {
      value,
      onChange,
      placeholder = '搜索并选择产品...',
      containerClassName,
      className,
      disabled = false,
      error = false,
      ...buttonProps
    },
    ref
  ) => {
    const { ['aria-invalid']: ariaInvalidProp, ...restButtonProps } =
      buttonProps;
    const {
      open,
      setOpen,
      selectedProduct,
      products,
      isLoading,
      error: selectorError,
      handleSearchChange,
      handleClear,
      handleCommandSelect,
    } = useProductSelector(value, onChange);

    const ariaInvalid = ariaInvalidProp;
    const isError =
      error ||
      ariaInvalid === true ||
      ariaInvalid === 'true' ||
      ariaInvalid === 'grammar' ||
      ariaInvalid === 'spelling';

    return (
      <div className={cn('relative', containerClassName)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={isError ? 'true' : ariaInvalidProp}
              className={cn(
                'w-full justify-between',
                className,
                isError && 'border-red-500 text-red-600 ring-2 ring-red-200'
              )}
              disabled={disabled}
              {...restButtonProps}
            >
              <SelectedProductDisplay
                selectedProduct={selectedProduct}
                placeholder={placeholder}
              />
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px] p-0" align="start">
            <ProductSearchList
              products={products}
              selectedProduct={selectedProduct}
              isLoading={isLoading}
              error={selectorError}
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
            className="hover:bg-muted absolute top-1/2 right-8 h-6 w-6 -translate-y-1/2 p-0"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }
);

ProductSelector.displayName = 'ProductSelector';
