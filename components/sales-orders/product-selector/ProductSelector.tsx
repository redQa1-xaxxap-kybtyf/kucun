'use client';

import { Check, ChevronsUpDown, Package, Search } from 'lucide-react';
import * as React from 'react';

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
import type { Product } from '@/lib/types/product';
import { cn } from '@/lib/utils';

interface ProductSelectorProps {
  products: Product[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface ProductSelectorViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  products: Product[];
  selectedProduct?: Product;
  placeholder: string;
  disabled: boolean;
  className?: string;
  onSelectProduct: (productId: string) => void;
}

export function ProductSelector(props: ProductSelectorProps) {
  const controller = useProductSelectorController(props);
  return <ProductSelectorView {...controller} />;
}

function ProductSelectorView({
  open,
  onOpenChange,
  searchValue,
  onSearchChange,
  products,
  selectedProduct,
  placeholder,
  disabled,
  className,
  onSelectProduct,
}: ProductSelectorViewProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <SelectorTrigger
          selectedProduct={selectedProduct}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜索产品名称、编码或规格..."
            value={searchValue}
            onValueChange={onSearchChange}
          />
          <CommandList>
            <EmptyState />
            <CommandGroup>
              {products.map(product => (
                <ProductOptionItem
                  key={product.id}
                  product={product}
                  isSelected={product.id === selectedProduct?.id}
                  onSelect={() => onSelectProduct(product.id)}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SelectorTrigger({
  selectedProduct,
  placeholder,
  disabled,
  className,
}: {
  selectedProduct?: Product;
  placeholder: string;
  disabled: boolean;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={Boolean(selectedProduct)}
      className={cn('w-full justify-between', className)}
      disabled={disabled}
    >
      {selectedProduct ? (
        <SelectedProductSummary product={selectedProduct} />
      ) : (
        <div className="text-muted-foreground flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span>{placeholder}</span>
        </div>
      )}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );
}

function SelectedProductSummary({ product }: { product: Product }) {
  return (
    <div className="flex items-center gap-2 truncate">
      <Package className="h-4 w-4 shrink-0" />
      <div className="flex items-center gap-2 truncate">
        {product.code && (
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 font-mono text-xs font-semibold text-blue-700"
          >
            {product.code}
          </Badge>
        )}
        <span className="truncate font-medium">{product.name}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <CommandEmpty>
      <div className="flex flex-col items-center gap-2 py-6">
        <Search className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm">未找到匹配的产品</p>
        <p className="text-muted-foreground text-xs">
          尝试使用产品名称、编码或规格搜索
        </p>
      </div>
    </CommandEmpty>
  );
}

interface ProductOptionItemProps {
  product: Product;
  isSelected: boolean;
  onSelect: () => void;
}

function ProductOptionItem({
  product,
  isSelected,
  onSelect,
}: ProductOptionItemProps) {
  return (
    <CommandItem
      value={`${product.code ?? ''} ${product.name ?? ''}`.trim()}
      onSelect={onSelect}
      className="flex items-center gap-3 p-3"
    >
      <Check
        className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{product.name}</span>
          {product.code && (
            <Badge variant="outline" className="text-xs">
              {product.code}
            </Badge>
          )}
        </div>
        {product.specification && (
          <div className="text-muted-foreground text-xs">
            规格：{product.specification}
          </div>
        )}
      </div>
    </CommandItem>
  );
}

function useProductSelectorController({
  products,
  value,
  onValueChange,
  placeholder = '选择产品',
  disabled = false,
  className,
}: ProductSelectorProps): ProductSelectorViewProps {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  const selectedProduct = React.useMemo(
    () => products.find(product => product.id === value),
    [products, value]
  );

  const filteredProducts = useFilteredProducts(products, searchValue);

  const handleSelectProduct = React.useCallback(
    (productId: string) => {
      onValueChange(productId);
      setOpen(false);
      setSearchValue('');
    },
    [onValueChange]
  );

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen && selectedProduct) {
        // 打开时，如果有已选商品，自动填充搜索框以便用户快速定位（优先使用编码）
        setSearchValue(selectedProduct.code || selectedProduct.name || '');
      } else if (!nextOpen) {
        // 关闭时清空搜索框
        setSearchValue('');
      }
    },
    [selectedProduct]
  );

  return {
    open,
    onOpenChange: handleOpenChange,
    searchValue,
    onSearchChange: setSearchValue,
    products: filteredProducts,
    selectedProduct,
    placeholder,
    disabled,
    className,
    onSelectProduct: handleSelectProduct,
  };
}

function useFilteredProducts(products: Product[], searchValue: string) {
  return React.useMemo(() => {
    if (!searchValue) {
      return products;
    }

    const searchLower = searchValue.toLowerCase();
    return products.filter(product => {
      const code = product.code?.toLowerCase() ?? '';
      const name = product.name?.toLowerCase() ?? '';
      const spec = product.specification?.toLowerCase() ?? '';
      const id = product.id?.toLowerCase() ?? '';

      return (
        code.includes(searchLower) ||
        name.includes(searchLower) ||
        spec.includes(searchLower) ||
        id.includes(searchLower)
      );
    });
  }, [products, searchValue]);
}

interface BatchProductSelectorProps {
  products: Product[];
  selectedProducts: string[];
  onSelectionChange: (productIds: string[]) => void;
  maxSelection?: number;
  disabled?: boolean;
}

interface BatchSelectorViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  products: Product[];
  selectedProducts: string[];
  maxSelection: number;
  disabled: boolean;
  onToggleProduct: (productId: string) => void;
}

export function BatchProductSelector(props: BatchProductSelectorProps) {
  const controller = useBatchProductSelectorController(props);
  return <BatchProductSelectorView {...controller} />;
}

function BatchProductSelectorView({
  open,
  onOpenChange,
  searchValue,
  onSearchChange,
  products,
  selectedProducts,
  maxSelection,
  disabled,
  onToggleProduct,
}: BatchSelectorViewProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>
              {selectedProducts.length > 0
                ? `已选择 ${selectedProducts.length} 个产品`
                : '批量选择产品'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="搜索产品..."
            value={searchValue}
            onValueChange={onSearchChange}
          />
          <CommandList>
            <CommandEmpty>未找到匹配的产品</CommandEmpty>
            <CommandGroup>
              {products.map(product => {
                const isSelected = selectedProducts.includes(product.id);
                const canSelect =
                  selectedProducts.length < maxSelection || isSelected;

                return (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => canSelect && onToggleProduct(product.id)}
                    className={cn(
                      'flex items-center gap-3 p-3',
                      !canSelect && 'cursor-not-allowed opacity-50'
                    )}
                    disabled={!canSelect}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {product.code && (
                          <Badge
                            variant="outline"
                            className="border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 px-2.5 py-0.5 font-mono text-xs font-bold text-blue-800 shadow-sm"
                          >
                            {product.code}
                          </Badge>
                        )}
                        <span className="font-medium">{product.name}</span>
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {product.specification}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function useBatchProductSelectorController({
  products,
  selectedProducts,
  onSelectionChange,
  maxSelection = 10,
  disabled = false,
}: BatchProductSelectorProps): BatchSelectorViewProps {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  const filteredProducts = useFilteredProducts(products, searchValue);

  const handleToggleProduct = React.useCallback(
    (productId: string) => {
      const nextSelection = selectedProducts.includes(productId)
        ? selectedProducts.filter(id => id !== productId)
        : [...selectedProducts, productId];
      onSelectionChange(nextSelection);
    },
    [onSelectionChange, selectedProducts]
  );

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      // 关闭时清空搜索框
      setSearchValue('');
    }
    // 注意：批量选择器不自动填充搜索框，因为有多个已选商品
  }, []);

  return {
    open,
    onOpenChange: handleOpenChange,
    searchValue,
    onSearchChange: setSearchValue,
    products: filteredProducts,
    selectedProducts,
    maxSelection,
    disabled,
    onToggleProduct: handleToggleProduct,
  };
}
