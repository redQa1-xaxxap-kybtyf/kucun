'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import React from 'react';

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
import { getProduct, getProducts, productQueryKeys } from '@/lib/api/products';
import type { Product } from '@/lib/types/product';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 250;
const MAX_DISPLAY_PRODUCTS = 10; // 最多显示10个产品

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

type ProductStatusFilter = 'active' | 'inactive' | 'all';

type ProductSelectorQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: 'active' | 'inactive';
  includeInventory: boolean;
  includeStatistics: boolean;
};

function buildProductSelectorQuery(
  search: string,
  status: ProductStatusFilter | undefined,
  limit: number
): ProductSelectorQuery {
  const normalizedSearch = search.trim();
  const normalizedStatus = status && status !== 'all' ? status : undefined;

  return {
    page: 1,
    limit,
    search: normalizedSearch.length > 0 ? normalizedSearch : undefined,
    status: normalizedStatus,
    includeInventory: false,
    includeStatistics: false,
  };
}

function ProductLabel({
  product,
  showCode,
  showSpecification,
}: {
  product: Product;
  showCode: boolean;
  showSpecification: boolean;
}) {
  // 格式化规格显示（限制11个字符，避免JSON字符串显示）
  const formattedSpecification = React.useMemo(() => {
    const spec = product.specification;
    if (!spec) {
      return null;
    }

    // 如果是JSON字符串，尝试解析并提取关键信息
    if (spec.startsWith('{') && spec.endsWith('}')) {
      try {
        const parsed = JSON.parse(spec);
        // 提取尺寸信息作为主要显示内容
        if (parsed.size) {
          return parsed.size.length > 11
            ? `${parsed.size.slice(0, 11)}...`
            : parsed.size;
        }
        // 如果没有尺寸，显示简化的规格信息
        return '规格详情...';
      } catch {
        // JSON解析失败，截断显示
        return spec.length > 11 ? `${spec.slice(0, 11)}...` : spec;
      }
    }

    // 普通字符串，直接截断
    return spec.length > 11 ? `${spec.slice(0, 11)}...` : spec;
  }, [product.specification]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {showCode && product.code && (
          <span className="text-muted-foreground font-mono text-sm">
            {product.code}
          </span>
        )}
        <span className="truncate text-sm font-medium">{product.name}</span>
        {product.status === 'inactive' && (
          <Badge variant="secondary" className="text-xs">
            停用
          </Badge>
        )}
      </div>
      {showSpecification && formattedSpecification && (
        <span className="text-muted-foreground truncate text-xs">
          {formattedSpecification}
        </span>
      )}
    </div>
  );
}

interface ProductSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCode?: boolean;
  showSpecification?: boolean;
  filterStatus?: ProductStatusFilter;
  label?: string;
  onProductChange?: (productId: string) => void;
}

export function ProductSelector({
  value,
  onValueChange,
  placeholder = '选择产品...',
  disabled = false,
  className,
  showCode = true,
  showSpecification = true,
  filterStatus = 'active',
  label,
  onProductChange,
}: ProductSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const queryInput = React.useMemo(
    () =>
      buildProductSelectorQuery(
        debouncedSearch,
        filterStatus,
        MAX_DISPLAY_PRODUCTS
      ),
    [debouncedSearch, filterStatus]
  );

  const { data: productsResponse, isFetching } = useQuery({
    queryKey: productQueryKeys.list(queryInput),
    queryFn: () => getProducts(queryInput),
    enabled: open,
    staleTime: 30_000,
  });

  const products = productsResponse?.data ?? [];
  const totalCount = productsResponse?.pagination?.total || 0;
  const hasMoreResults = totalCount > MAX_DISPLAY_PRODUCTS;
  const selectedProductFromList = value
    ? products.find(product => product.id === value)
    : undefined;

  const shouldQueryById = Boolean(
    value && !selectedProductFromList && !isFetching
  );

  const { data: selectedProductFallback } = useQuery<Product>({
    queryKey: productQueryKeys.detail(value || ''),
    queryFn: () => getProduct(value as string),
    enabled: shouldQueryById,
    staleTime: 60_000,
  });

  const selectedProduct = selectedProductFromList || selectedProductFallback;

  const handleSelect = React.useCallback(
    (product: Product) => {
      onValueChange(product.id);
      onProductChange?.(product.id);
      setSearchValue('');
      setOpen(false);
    },
    [onProductChange, onValueChange]
  );

  const handleSearchChange = React.useCallback((search: string) => {
    setSearchValue(search);
  }, []);

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between',
              !value && 'text-muted-foreground',
              className
            )}
            disabled={disabled}
          >
            {selectedProduct ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
                <ProductLabel
                  product={selectedProduct}
                  showCode={showCode}
                  showSpecification={showSpecification}
                />
              </div>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="搜索产品..."
              value={searchValue}
              onValueChange={handleSearchChange}
            />
            <CommandList>
              <CommandEmpty>
                {isFetching ? '加载中...' : '未找到产品'}
              </CommandEmpty>
              <CommandGroup>
                {hasMoreResults && (
                  <div className="text-muted-foreground px-2 py-1.5 text-xs">
                    显示前 {MAX_DISPLAY_PRODUCTS} 个结果，请细化搜索
                  </div>
                )}
                {products.map(product => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => handleSelect(product)}
                  >
                    <ProductLabel
                      product={product}
                      showCode={showCode}
                      showSpecification={showSpecification}
                    />
                    <Check
                      className={cn(
                        'ml-2 h-4 w-4',
                        value === product.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface MultiProductSelectorProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCode?: boolean;
  showSpecification?: boolean;
  filterStatus?: ProductStatusFilter;
  label?: string;
  maxItems?: number;
}

export function MultiProductSelector({
  value,
  onValueChange,
  placeholder = '选择产品...',
  disabled = false,
  className,
  showCode = true,
  showSpecification = true,
  filterStatus = 'active',
  label,
  maxItems,
}: MultiProductSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const queryInput = React.useMemo(
    () => buildProductSelectorQuery(debouncedSearch, filterStatus, 50),
    [debouncedSearch, filterStatus]
  );

  const { data: productsResponse, isFetching } = useQuery({
    queryKey: productQueryKeys.list(queryInput),
    queryFn: () => getProducts(queryInput),
    enabled: open,
    staleTime: 30_000,
  });

  const products = productsResponse?.data ?? [];

  const selectedProductsQueryKey = React.useMemo(
    () => productQueryKeys.list({ ids: [...value].sort().join(',') }),
    [value]
  );

  const { data: persistedProducts } = useQuery<Product[]>({
    queryKey: selectedProductsQueryKey,
    queryFn: async (): Promise<Product[]> => {
      const uniqueIds = Array.from(new Set(value));
      const results = await Promise.allSettled(
        uniqueIds.map(id => getProduct(id))
      );
      return results
        .filter(
          (item): item is PromiseFulfilledResult<Product> =>
            item.status === 'fulfilled'
        )
        .map(item => item.value);
    },
    enabled: value.length > 0,
    staleTime: 60_000,
  });

  const productMap = React.useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(product => map.set(product.id, product));
    persistedProducts?.forEach(product => map.set(product.id, product));
    return map;
  }, [persistedProducts, products]);

  const selectedProducts = React.useMemo(
    () =>
      value
        .map(id => productMap.get(id))
        .filter((product): product is Product => Boolean(product)),
    [productMap, value]
  );

  const handleSelect = React.useCallback(
    (product: Product) => {
      const exists = value.includes(product.id);
      let nextValue: string[];

      if (exists) {
        nextValue = value.filter(id => id !== product.id);
      } else if (maxItems && value.length >= maxItems) {
        nextValue = value;
      } else {
        nextValue = [...value, product.id];
      }

      onValueChange(nextValue);
      setSearchValue('');
    },
    [maxItems, onValueChange, value]
  );

  const handleRemove = React.useCallback(
    (productId: string) => {
      onValueChange(value.filter(id => id !== productId));
    },
    [onValueChange, value]
  );

  return (
    <div className={cn('space-y-2', className)}>
      {label && <label className="text-sm font-medium">{label}</label>}

      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedProducts.map(product => (
            <Badge key={product.id} variant="secondary" className="text-xs">
              {showCode && product.code && (
                <span className="mr-1 font-mono">{product.code}</span>
              )}
              {product.name}
              <button
                type="button"
                className="hover:text-destructive ml-1"
                onClick={() => handleRemove(product.id)}
                disabled={disabled}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || Boolean(maxItems && value.length >= maxItems)}
          >
            {value.length > 0 ? `已选择 ${value.length} 个产品` : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="搜索产品..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {isFetching ? '加载中...' : '未找到产品'}
              </CommandEmpty>
              <CommandGroup>
                {products.map(product => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => handleSelect(product)}
                    className="flex items-center justify-between"
                  >
                    <ProductLabel
                      product={product}
                      showCode={showCode}
                      showSpecification={showSpecification}
                    />
                    <Check
                      className={cn(
                        'ml-2 h-4 w-4',
                        value.includes(product.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
