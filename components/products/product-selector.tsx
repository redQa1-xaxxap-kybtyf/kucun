'use client';

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
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useCallback, useState } from 'react';

interface ProductSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCode?: boolean;
  showSpecification?: boolean;
  filterStatus?: 'active' | 'inactive' | 'all';
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
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // 获取产品列表
  const { data: productsResponse, isLoading } = useQuery({
    queryKey: productQueryKeys.list({
      search: searchValue,
      status: filterStatus === 'all' ? undefined : filterStatus,
      limit: 100,
    }),
    queryFn: () => getProducts({
      search: searchValue,
      status: filterStatus === 'all' ? undefined : filterStatus,
      limit: 100,
    }),
  });

  const products = productsResponse?.data || [];
  const selectedProduct = products.find(product => product.id === value);

  const handleSelect = useCallback((productId: string) => {
    onValueChange(productId);
    onProductChange?.(productId);
    setOpen(false);
  }, [onValueChange, onProductChange]);

  const handleSearchChange = useCallback((search: string) => {
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
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">
                {showCode && selectedProduct.code && (
                  <span className="font-mono text-sm text-muted-foreground">
                    {selectedProduct.code}
                  </span>
                )}
                <span className={showCode && selectedProduct.code ? 'ml-2' : ''}>
                  {selectedProduct.name}
                </span>
              </span>
              {selectedProduct.status === 'inactive' && (
                <Badge variant="secondary" className="text-xs">
                  停用
                </Badge>
              )}
            </div>
          ) : (
            placeholder
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
              {isLoading ? '加载中...' : '未找到产品'}
            </CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => handleSelect(product.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {showCode && product.code && (
                        <span className="font-mono text-sm text-muted-foreground">
                          {product.code}
                        </span>
                      )}
                      <span className="truncate">{product.name}</span>
                      {product.status === 'inactive' && (
                        <Badge variant="secondary" className="text-xs">
                          停用
                        </Badge>
                      )}
                    </div>
                    {showSpecification && product.specification && (
                      <span className="text-sm text-muted-foreground truncate">
                        {product.specification}
                      </span>
                    )}
                  </div>
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

// 多选产品选择器
interface MultiProductSelectorProps {
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxItems?: number;
  showCode?: boolean;
  filterStatus?: 'active' | 'inactive' | 'all';
}

export function MultiProductSelector({
  value = [],
  onValueChange,
  placeholder = '选择产品...',
  disabled = false,
  className,
  maxItems,
  showCode = true,
  filterStatus = 'active',
}: MultiProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // 获取产品列表
  const { data: productsResponse, isLoading } = useQuery({
    queryKey: productQueryKeys.list({
      search: searchValue,
      status: filterStatus === 'all' ? undefined : filterStatus,
      limit: 100,
    }),
    queryFn: () => getProducts({
      search: searchValue,
      status: filterStatus === 'all' ? undefined : filterStatus,
      limit: 100,
    }),
  });

  const products = productsResponse?.data || [];
  const selectedProducts = products.filter(product => value.includes(product.id));

  const handleSelect = useCallback((productId: string) => {
    const newValue = value.includes(productId)
      ? value.filter(id => id !== productId)
      : maxItems && value.length >= maxItems
      ? value
      : [...value, productId];

    onValueChange(newValue);
  }, [value, onValueChange, maxItems]);

  const handleRemove = useCallback((productId: string) => {
    onValueChange(value.filter(id => id !== productId));
  }, [value, onValueChange]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* 已选择的产品 */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedProducts.map((product) => (
            <Badge
              key={product.id}
              variant="secondary"
              className="text-xs"
            >
              {showCode && product.code && (
                <span className="font-mono mr-1">{product.code}</span>
              )}
              {product.name}
              <button
                type="button"
                className="ml-1 hover:text-destructive"
                onClick={() => handleRemove(product.id)}
                disabled={disabled}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* 产品选择器 */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || !!(maxItems && value.length >= maxItems)}
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
                {isLoading ? '加载中...' : '未找到产品'}
              </CommandEmpty>
              <CommandGroup>
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => handleSelect(product.id)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {showCode && product.code && (
                          <span className="font-mono text-sm text-muted-foreground">
                            {product.code}
                          </span>
                        )}
                        <span className="truncate">{product.name}</span>
                        {product.status === 'inactive' && (
                          <Badge variant="secondary" className="text-xs">
                            停用
                          </Badge>
                        )}
                      </div>
                    </div>
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
