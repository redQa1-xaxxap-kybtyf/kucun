'use client';

import { ChevronsUpDown, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/console-logger';

import { ProductSearchEmptyState } from './components/ProductSearchEmptyState';
import { ProductSearchLoadingIndicator } from './components/ProductSearchLoadingIndicator';
import { ProductSearchResults } from './components/ProductSearchResults';
import { useSmartProductSearchController } from './hooks/useSmartProductSearchController';
import type { ProductWithInventory, SmartProductSearchProps } from './types';

const AddTemporaryProductDialog = dynamic(
  () =>
    import('../add-temporary-product-dialog/AddTemporaryProductDialog').then(
      mod => mod.AddTemporaryProductDialog
    ),
  { ssr: false, loading: () => null }
);

export function SmartProductSearch(props: SmartProductSearchProps) {
  const isMobile = useIsMobile();
  const variant: 'mobile' | 'desktop' = isMobile ? 'mobile' : 'desktop';
  const {
    open,
    setOpen: setPopoverOpen,
    searchValue,
    handleSearchValueChange,
    showAddDialog,
    setShowAddDialog,
    filteredProducts,
    isSearchPending,
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

  const isSearchingResults = isSearching || isSearchPending;
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
      logger.error(
        'components:sales-orders:smart-product-search',
        'onBlur failed',
        error
      );
    };

    try {
      const result = onBlur();
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
      {isMobile ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetTrigger asChild>
            <SmartProductSearchTriggerButton
              open={open}
              selectedProduct={selectedProduct}
              selectedSpecification={selectedSpecification}
              placeholder={placeholder}
              simple={simple}
              disabled={disabled}
              className={cn('min-h-11', className)}
              onBlur={notifyBlur}
            />
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="flex h-[85vh] flex-col gap-0 rounded-t-3xl p-0"
          >
            <Command shouldFilter={false} className="flex h-full flex-col">
              <SheetHeader className="gap-2 border-b bg-background px-4 pb-3 pt-4 text-left">
                <SheetTitle className="text-base">选择产品</SheetTitle>
                <CommandInput
                  placeholder="输入产品名称、编码或规格搜索..."
                  value={searchValue}
                  onValueChange={handleSearchValueChange}
                  className="h-12"
                />
              </SheetHeader>
              <CommandList className="max-h-none flex-1">
                {isSearchingResults ? <ProductSearchLoadingIndicator /> : null}
                {hasResults ? (
                  <ProductSearchResults
                    products={filteredProducts}
                    selectedValue={props.value}
                    searchQuery={displaySearchValue}
                    onSelectProduct={handleProductSelectWithBlur}
                    onSelectBatch={handleBatchSelectWithBlur}
                    variant={variant}
                  />
                ) : (
                  <CommandEmpty>
                    <ProductSearchEmptyState
                      searchValue={displaySearchValue}
                      isSearching={isSearchingResults}
                      allowTemporaryProducts={allowTemporaryProducts}
                      onAddTemporaryProduct={handleAddTemporaryProduct}
                      variant={variant}
                    />
                  </CommandEmpty>
                )}
              </CommandList>
            </Command>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <SmartProductSearchTriggerButton
              open={open}
              selectedProduct={selectedProduct}
              selectedSpecification={selectedSpecification}
              placeholder={placeholder}
              simple={simple}
              disabled={disabled}
              className={className}
              onBlur={notifyBlur}
            />
          </PopoverTrigger>
          <PopoverContent className="w-[620px] p-0" align="start">
            <SmartProductSearchPanel
              searchValue={searchValue}
              onSearchValueChange={handleSearchValueChange}
              isSearchingResults={isSearchingResults}
              hasResults={hasResults}
              filteredProducts={filteredProducts}
              selectedValue={props.value}
              searchQuery={displaySearchValue}
              onSelectProduct={handleProductSelectWithBlur}
              onSelectBatch={handleBatchSelectWithBlur}
              allowTemporaryProducts={allowTemporaryProducts}
              onAddTemporaryProduct={handleAddTemporaryProduct}
              variant={variant}
            />
          </PopoverContent>
        </Popover>
      )}
      {showAddDialog && (
        <AddTemporaryProductDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          initialName={searchValue}
          onConfirm={handleTemporaryProductAdded}
          requirements={temporaryProductRequirements}
        />
      )}
    </>
  );
}

interface SmartProductSearchTriggerButtonProps
  extends React.ComponentPropsWithoutRef<typeof Button>,
    TriggerContentProps {
  open: boolean;
  onBlur: () => void;
}

const SmartProductSearchTriggerButton = React.forwardRef<
  React.ElementRef<typeof Button>,
  SmartProductSearchTriggerButtonProps
>(
  (
    {
      open,
      selectedProduct,
      selectedSpecification,
      placeholder,
      simple,
      disabled,
      className,
      onBlur,
      ...props
    },
    ref
  ) => (
    <Button
      {...props}
      ref={ref}
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
      onBlur={onBlur}
    >
      <SmartProductSearchTriggerContent
        selectedProduct={selectedProduct}
        selectedSpecification={selectedSpecification}
        placeholder={placeholder}
        simple={simple}
      />
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  )
);
SmartProductSearchTriggerButton.displayName = 'SmartProductSearchTriggerButton';

interface SmartProductSearchPanelProps {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  isSearchingResults: boolean;
  hasResults: boolean;
  filteredProducts: ProductWithInventory[];
  selectedValue?: string;
  searchQuery: string;
  onSelectProduct: (productId: string) => void;
  onSelectBatch: (productId: string, batchNumber: string) => void;
  allowTemporaryProducts: boolean;
  onAddTemporaryProduct: () => void;
  listClassName?: string;
  variant: 'desktop' | 'mobile';
}

function SmartProductSearchPanel({
  searchValue,
  onSearchValueChange,
  isSearchingResults,
  hasResults,
  filteredProducts,
  selectedValue,
  searchQuery,
  onSelectProduct,
  onSelectBatch,
  allowTemporaryProducts,
  onAddTemporaryProduct,
  listClassName,
  variant,
}: SmartProductSearchPanelProps) {
  return (
    <Command shouldFilter={false} className="flex h-full flex-col">
      <CommandInput
        placeholder="输入产品名称、编码或规格搜索..."
        value={searchValue}
        onValueChange={onSearchValueChange}
        className="h-10"
      />
      <CommandList className={cn('max-h-[400px]', listClassName)}>
        {isSearchingResults ? <ProductSearchLoadingIndicator /> : null}
        {hasResults ? (
          <ProductSearchResults
            products={filteredProducts}
            selectedValue={selectedValue}
            searchQuery={searchQuery}
            onSelectProduct={onSelectProduct}
            onSelectBatch={onSelectBatch}
            variant={variant}
          />
        ) : (
          <CommandEmpty>
            <ProductSearchEmptyState
              searchValue={searchQuery}
              isSearching={isSearchingResults}
              allowTemporaryProducts={allowTemporaryProducts}
              onAddTemporaryProduct={onAddTemporaryProduct}
              variant={variant}
            />
          </CommandEmpty>
        )}
      </CommandList>
    </Command>
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
