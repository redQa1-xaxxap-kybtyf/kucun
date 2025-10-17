'use client';

import {
  Check,
  ChevronsUpDown,
  Loader2,
  Package,
  Plus,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';
import { ProductDataUtils } from '@/lib/utils/product-data';

import { AddTemporaryProductDialog } from './add-temporary-product-dialog';

interface ProductWithInventory {
  id: string;
  code: string;
  name: string;
  specification?: string | null;
  unit: string;
  piecesPerUnit?: number | null;
  status?: string;
  inventory?: {
    totalInventory: number;
    availableInventory: number;
    reservedInventory: number;
    batches?: Array<{
      batchNumber: string;
      quantity: number;
    }>;
  } | null;
}

interface SmartProductSearchProps {
  products: ProductWithInventory[];
  value?: string;
  onValueChange?: (value: string) => void;
  onBatchSelect?: (productId: string, batchNumber: string) => void;
  onTemporaryProductAdd?: (productData: {
    name: string;
    specification?: string;
    weight?: number;
    unit?: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowTemporaryProducts?: boolean;
  onSearchChange?: (query: string) => void;
  isSearching?: boolean;
  simple?: boolean;
}

export function SmartProductSearch(props: SmartProductSearchProps) {
  const {
    open,
    setOpen,
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
    placeholder = '搜索商品',
    disabled = false,
    className,
    allowTemporaryProducts = false,
    isSearching = false,
    simple = false,
  } = props;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
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
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex min-w-0 flex-col">
                {selectedProduct ? (
                  simple ? (
                    <span className="truncate font-mono">
                      {selectedProduct.code || selectedProduct.name}
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-2 truncate">
                        {selectedProduct.code && (
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 px-2 font-mono text-xs font-semibold text-blue-700"
                          >
                            {selectedProduct.code}
                          </Badge>
                        )}
                        <span className="font-medium">
                          {selectedProduct.name}
                        </span>
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
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[620px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="输入商品名称、编码或规格搜索..."
              value={searchValue}
              onValueChange={handleSearchValueChange}
              className="h-10"
            />
            <CommandList className="max-h-[400px]">
              {isSearching && <ProductSearchLoadingIndicator />}
              {filteredProducts.length > 0 ? (
                <ProductSearchResults
                  products={filteredProducts}
                  selectedValue={props.value}
                  onSelectProduct={handleProductSelect}
                  onSelectBatch={handleBatchSelect}
                />
              ) : (
                <ProductSearchEmptyState
                  searchValue={searchValue}
                  isSearching={isSearching}
                  allowTemporaryProducts={allowTemporaryProducts}
                  onAddTemporaryProduct={handleAddTemporaryProduct}
                />
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
      />
    </>
  );
}

function useSmartProductSearchController({
  products,
  value,
  onValueChange,
  onBatchSelect,
  onTemporaryProductAdd,
  onSearchChange,
}: SmartProductSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchValue('');
      onSearchChange?.('');
    }
  }, [open, onSearchChange]);

  const handleSearchValueChange = useCallback(
    (nextValue: string) => {
      setSearchValue(nextValue);
      onSearchChange?.(nextValue);
    },
    [onSearchChange]
  );

  const filteredProducts = useMemo(
    () => filterProducts(products, searchValue),
    [products, searchValue]
  );

  const selectedProduct = useMemo(
    () => products.find(product => product.id === value),
    [products, value]
  );

  const handleProductSelect = useCallback(
    (productId: string) => {
      onValueChange?.(productId);
      setOpen(false);
      setSearchValue('');
      onSearchChange?.('');
    },
    [onValueChange, onSearchChange]
  );

  const handleBatchSelect = useCallback(
    (productId: string, batchNumber: string) => {
      onBatchSelect?.(productId, batchNumber);
      setOpen(false);
      setSearchValue('');
      onSearchChange?.('');
    },
    [onBatchSelect, onSearchChange]
  );

  const handleAddTemporaryProduct = useCallback(() => {
    setShowAddDialog(true);
    setOpen(false);
  }, []);

  const handleTemporaryProductAdded = useCallback(
    (productData: {
      name: string;
      specification?: string;
      weight?: number;
      unit?: string;
    }) => {
      onTemporaryProductAdd?.(productData);
      setShowAddDialog(false);
      setSearchValue('');
      onSearchChange?.('');
    },
    [onTemporaryProductAdd, onSearchChange]
  );

  const selectedSpecification = useMemo(
    () => formatProductSpecification(selectedProduct?.specification, 40),
    [selectedProduct]
  );

  return {
    open,
    setOpen,
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
  };
}

function ProductSearchLoadingIndicator() {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-3 text-xs">
      <Loader2 className="h-4 w-4 animate-spin" />
      正在搜索...
    </div>
  );
}

function ProductSearchEmptyState({
  searchValue,
  isSearching,
  allowTemporaryProducts,
  onAddTemporaryProduct,
}: {
  searchValue: string;
  isSearching: boolean;
  allowTemporaryProducts: boolean;
  onAddTemporaryProduct: () => void;
}) {
  return (
    <CommandEmpty className="py-6 text-center">
      <div className="space-y-3">
        <div className="text-muted-foreground">
          {isSearching
            ? '正在搜索商品...'
            : searchValue
              ? `未找到匹配的商品 "${searchValue}"`
              : '请输入关键词搜索商品'}
        </div>
        {allowTemporaryProducts && searchValue && !isSearching && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddTemporaryProduct}
            className="mx-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加为临时商品
          </Button>
        )}
      </div>
    </CommandEmpty>
  );
}

function ProductSearchResults({
  products,
  selectedValue,
  onSelectProduct,
  onSelectBatch,
}: {
  products: ProductWithInventory[];
  selectedValue?: string;
  onSelectProduct: (productId: string) => void;
  onSelectBatch: (productId: string, batchNumber: string) => void;
}) {
  return (
    <CommandGroup>
      {products.map(product => (
        <ProductSearchResultItem
          key={product.id}
          product={product}
          isSelected={selectedValue === product.id}
          onSelectProduct={onSelectProduct}
          onSelectBatch={onSelectBatch}
        />
      ))}
    </CommandGroup>
  );
}

function ProductSearchResultItem({
  product,
  isSelected,
  onSelectProduct,
  onSelectBatch,
}: {
  product: ProductWithInventory;
  isSelected: boolean;
  onSelectProduct: (productId: string) => void;
  onSelectBatch: (productId: string, batchNumber: string) => void;
}) {
  const specification = formatProductSpecification(product.specification);
  const piecesPerUnit = product.piecesPerUnit ?? 0;
  const availableDisplay = formatInventoryQuantity(
    product.inventory?.availableInventory ?? 0,
    piecesPerUnit
  );
  const totalDisplay = formatInventoryQuantity(
    product.inventory?.totalInventory ?? 0,
    piecesPerUnit
  );
  const renderedKeywords = buildProductKeywords(product, specification);

  return (
    <CommandItem
      value={renderedKeywords.join(' ')}
      keywords={renderedKeywords}
      onSelect={() => onSelectProduct(product.id)}
      className="flex items-start justify-between gap-4 p-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Check
          className={cn(
            'h-4 w-4 shrink-0',
            isSelected ? 'opacity-100' : 'opacity-0'
          )}
        />
        <Package className="text-muted-foreground h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            {product.code && (
              <Badge
                variant="outline"
                className="border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 px-2.5 py-0.5 font-mono text-xs font-bold text-blue-800 shadow-sm"
              >
                {product.code}
              </Badge>
            )}
            <span className="font-semibold text-gray-900">{product.name}</span>
            {product.status === 'inactive' && (
              <Badge variant="secondary" className="text-xs">
                停用
              </Badge>
            )}
          </div>
          {specification && (
            <div className="text-sm text-gray-600">规格：{specification}</div>
          )}
          {product.inventory?.batches &&
            product.inventory.batches.length > 0 && (
              <ProductBatchList
                productId={product.id}
                batches={product.inventory.batches}
                piecesPerUnit={piecesPerUnit}
                onSelectBatch={onSelectBatch}
              />
            )}
        </div>
      </div>
      {product.inventory && (
        <div className="shrink-0 space-y-1 text-right">
          <div className="rounded-md bg-green-50 px-3 py-1">
            <div className="text-xs text-gray-600">可用库存</div>
            <div className="text-sm font-semibold text-green-600">
              {availableDisplay}
            </div>
          </div>
          {product.inventory.totalInventory !==
            product.inventory.availableInventory && (
            <div className="text-xs text-gray-500">总量 {totalDisplay}</div>
          )}
        </div>
      )}
    </CommandItem>
  );
}

function ProductBatchList({
  productId,
  batches,
  piecesPerUnit,
  onSelectBatch,
}: {
  productId: string;
  batches: Array<{ batchNumber: string; quantity: number }>;
  piecesPerUnit: number;
  onSelectBatch: (productId: string, batchNumber: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-600">
        点击批次进行选择：
      </div>
      <div className="flex flex-wrap gap-2">
        {batches.map(batch => (
          <button
            key={`${productId}-${batch.batchNumber}`}
            type="button"
            onClick={event => {
              event.stopPropagation();
              onSelectBatch(productId, batch.batchNumber);
            }}
            className="flex items-center gap-1.5 rounded-md border-2 border-blue-200 bg-blue-50 px-3 py-1.5 text-xs transition-all hover:border-blue-400 hover:bg-blue-100 hover:shadow-md active:scale-95"
          >
            <span className="font-mono font-semibold text-blue-700">
              {batch.batchNumber}
            </span>
            <span className="text-gray-400">|</span>
            <span className="font-medium text-green-600">
              {formatInventoryQuantity(batch.quantity, piecesPerUnit)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function filterProducts(products: ProductWithInventory[], searchValue: string) {
  if (!searchValue) {
    return products;
  }

  const keyword = searchValue.toLowerCase();
  return products.filter(product => {
    const specification = formatProductSpecification(product.specification);
    const specificationLower = specification.toLowerCase();

    return (
      product.name.toLowerCase().includes(keyword) ||
      product.code.toLowerCase().includes(keyword) ||
      specificationLower.includes(keyword)
    );
  });
}

function formatProductSpecification(spec?: string | null, truncateTo?: number) {
  const formatted =
    ProductDataUtils.formatter.formatSpecification(spec ?? '') || '';
  const sanitized = formatted.trim();

  if (
    !sanitized ||
    sanitized === '-' ||
    sanitized.toLowerCase() === '规格详情'
  ) {
    return '';
  }

  if (truncateTo && sanitized.length > truncateTo) {
    return `${sanitized.slice(0, truncateTo)}...`;
  }

  return sanitized;
}

function formatInventoryQuantity(quantity: number, piecesPerUnit: number) {
  return formatPieceSummary(quantity, piecesPerUnit, {
    fallbackUnit: '片',
    zeroDisplay: '0片',
  });
}

function buildProductKeywords(
  product: ProductWithInventory,
  specification: string
) {
  return [product.code, product.name, specification, product.id].filter(
    (token): token is string => Boolean(token)
  );
}
