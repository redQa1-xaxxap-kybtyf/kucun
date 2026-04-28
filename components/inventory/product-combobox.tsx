'use client';

import { X } from 'lucide-react';
import React from 'react';

import { ProductSearchResults } from '@/components/inventory/product-selector/product-search-results';
import { Command, CommandInput } from '@/components/ui/command';
import { Popover } from '@/components/ui/popover';
import { useProductSelector } from '@/hooks/use-product-selector';
import type { ProductOption } from '@/lib/types/inbound';
import { cn } from '@/lib/utils';

interface ProductComboboxProps {
  value: string;
  onChange: (value: string, product?: ProductOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

/**
 * 产品Combobox组件
 * 支持直接输入搜索，无需先点击按钮
 * 提供更自然的用户体验
 */
export function ProductCombobox({
  value,
  onChange,
  placeholder = '搜索产品名称、编码...',
  disabled = false,
  className,
  autoFocus = false,
}: ProductComboboxProps) {
  const {
    open,
    setOpen,
    searchInput,
    selectedProduct,
    products,
    isLoading,
    error,
    handleSearchChange,
    handleClear,
    handleCommandSelect,
  } = useProductSelector(value, onChange);

  const handleClearClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      handleClear();
    },
    [handleClear]
  );

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') {
        return;
      }

      const nativeEvent = event.nativeEvent as KeyboardEvent;
      if (nativeEvent.isComposing || nativeEvent.keyCode === 229) {
        return;
      }

      if (!open || isLoading || error || products.length === 0) {
        return;
      }

      const commandRoot = event.currentTarget.closest('[cmdk-root]');
      const highlightedItem = commandRoot?.querySelector<HTMLElement>(
        '[cmdk-item][data-selected="true"]'
      );
      const highlightedProductId = highlightedItem?.dataset.productValue;

      event.preventDefault();
      handleCommandSelect(highlightedProductId ?? products[0].value);
    },
    [error, handleCommandSelect, isLoading, open, products]
  );

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <Command
          filter={() => 1}
          className="overflow-visible bg-transparent"
        >
          <div className="group border-input ring-offset-background focus-within:ring-ring rounded-md border px-3 py-1.5 text-sm focus-within:ring-1 focus-within:ring-offset-0">
            <div className="flex flex-wrap gap-1">
              {selectedProduct && (
                <div className="flex items-center gap-1 rounded bg-[hsl(var(--color-primary-light))] px-2 py-0.5">
                  <span className="text-xs font-medium text-[hsl(var(--color-primary))]">
                    {selectedProduct.label}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={handleClearClick}
                      className="ml-1 rounded hover:bg-[hsl(var(--color-primary-light))]"
                    >
                      <X className="h-3 w-3 text-[hsl(var(--color-primary))]" />
                    </button>
                  )}
                </div>
              )}
              <CommandInput
                value={searchInput}
                placeholder={selectedProduct ? '' : placeholder}
                autoFocus={autoFocus}
                onValueChange={handleSearchChange}
                onKeyDown={handleInputKeyDown}
                onFocus={() => {
                  if (searchInput.length > 0 || products.length > 0) {
                    setOpen(true);
                  }
                }}
                disabled={disabled}
                className="placeholder:text-muted-foreground ml-2 flex-1 bg-transparent outline-hidden"
              />
            </div>
          </div>
          <div className="relative mt-1">
            {open && (searchInput.length > 0 || products.length > 0 || isLoading) && (
              <div className="bg-popover text-popover-foreground animate-in absolute top-0 z-10 w-full rounded-md border shadow-md outline-hidden">
                {error ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    搜索失败: {error.message}
                  </div>
                ) : (
                  <ProductSearchResults
                    products={products}
                    selectedProduct={selectedProduct}
                    isLoading={isLoading}
                    onSelect={handleCommandSelect}
                  />
                )}
              </div>
            )}
          </div>
        </Command>
      </Popover>
    </div>
  );
}
