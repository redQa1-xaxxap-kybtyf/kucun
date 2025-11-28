'use client';

import { ChevronsUpDown, Search } from 'lucide-react';
import React from 'react';
import { ZodError } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { AddTemporaryProductDialog } from '../add-temporary-product-dialog';

import { ProductSearchEmptyState } from './components/ProductSearchEmptyState';
import { ProductSearchLoadingIndicator } from './components/ProductSearchLoadingIndicator';
import { ProductSearchResults } from './components/ProductSearchResults';
import { useSmartProductSearchController } from './hooks/useSmartProductSearchController';
import type { ProductWithInventory, SmartProductSearchProps } from './types';

export function SmartProductSearch(props: SmartProductSearchProps) {
  const {
    open,
    setOpen: setPopoverOpen,
    searchValue,
    handleSearchValueChange,
    showAddDialog,
    setShowAddDialog,
    filteredProducts,
    selectedProduct,
    selectedSpecification,
    handleProductSelect,
    handleBatchSelect,
    handleAddTemporaryProduct,
    handleTemporaryProductAdded,
  } = useSmartProductSearchController(props);

  const {
    placeholder = '搜索产品',
    disabled = false,
    className,
    allowTemporaryProducts = false,
    isSearching = false,
    simple = false,
    temporaryProductRequirements,
    onBlur,
  } = props;

  const displaySearchValue = searchValue.trim();
  const hasResults = Boolean(displaySearchValue && filteredProducts.length > 0);

  const notifyBlur = React.useCallback(() => {
    if (!onBlur) {
      return;
    }

    const handleError = (error: unknown) => {
      if (error instanceof ZodError) {
        return;
      }
      console.error('smart-product-search:onBlur failed', error);
    };

    try {
      // ✅ 调用onBlur,可能返回void或Promise<void>
      const result = onBlur();
      // ✅ 检查是否为Promise,如果是则添加错误处理
      if (
        result !== undefined &&
        typeof (result as Promise<unknown>).catch === 'function'
      ) {
        (result as Promise<unknown>).catch(handleError);
      }
    } catch (error) {
      handleError(error);
    }
  }, [onBlur]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setPopoverOpen(nextOpen);
      if (!nextOpen) {
        notifyBlur();
      }
    },
    [setPopoverOpen, notifyBlur]
  );

  const handleProductSelectWithBlur = React.useCallback(
    (productId: string) => {
      handleProductSelect(productId);
      notifyBlur();
    },
    [handleProductSelect, notifyBlur]
  );

  const handleBatchSelectWithBlur = React.useCallback(
    (productId: string, batchNumber: string) => {
      handleBatchSelect(productId, batchNumber);
      notifyBlur();
    },
    [handleBatchSelect, notifyBlur]
  );

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between text-left font-normal',
              !selectedProduct && 'text-muted-foreground',
              className
            )}
            disabled={disabled}
            onBlur={notifyBlur}
          >
            <SmartProductSearchTriggerContent
              selectedProduct={selectedProduct}
              selectedSpecification={selectedSpecification}
              placeholder={placeholder}
              simple={simple}
            />
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[620px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="输入产品名称、编码或规格搜索..."
              value={searchValue}
              onValueChange={handleSearchValueChange}
              className="h-10"
            />
            <CommandList className="max-h-[400px]">
              {isSearching && <ProductSearchLoadingIndicator />}
              {hasResults ? (
                <ProductSearchResults
                  products={filteredProducts}
                  selectedValue={props.value}
                  searchQuery={displaySearchValue}
                  onSelectProduct={handleProductSelectWithBlur}
                  onSelectBatch={handleBatchSelectWithBlur}
                />
              ) : (
                <CommandEmpty>
                  <ProductSearchEmptyState
                    searchValue={displaySearchValue}
                    isSearching={isSearching}
                    allowTemporaryProducts={allowTemporaryProducts}
                    onAddTemporaryProduct={handleAddTemporaryProduct}
                  />
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <AddTemporaryProductDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        initialName={searchValue}
        onConfirm={handleTemporaryProductAdded}
        requirements={temporaryProductRequirements}
      />
    </>
  );
}

interface TriggerContentProps {
  selectedProduct: ProductWithInventory | null;
  selectedSpecification: string;
  placeholder: string;
  simple: boolean;
}

function SmartProductSearchTriggerContent({
  selectedProduct,
  selectedSpecification,
  placeholder,
  simple,
}: TriggerContentProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex min-w-0 flex-col">
        {selectedProduct ? (
          simple ? (
            <span className="truncate text-sm text-gray-700">
              {selectedProduct.code || selectedProduct.name}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-2 truncate">
                {selectedProduct.code && (
                  <Badge
                    variant="outline"
                    className="border-[hsl(var(--color-primary-light))] bg-[hsl(var(--color-primary-light))] px-2 font-mono text-xs font-semibold text-[hsl(var(--color-primary))]"
                  >
                    {selectedProduct.code}
                  </Badge>
                )}
                <span className="font-medium">{selectedProduct.name}</span>
              </span>
              {selectedSpecification && (
                <span className="text-muted-foreground truncate text-xs">
                  规格：{selectedSpecification}
                </span>
              )}
            </>
          )
        ) : (
          placeholder
        )}
      </span>
    </div>
  );
}
